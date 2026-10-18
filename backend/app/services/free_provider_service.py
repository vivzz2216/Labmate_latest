"""Fixed-endpoint, free-model-only adapters; no paid model substitution."""
import json
import asyncio
import logging
import re

import httpx
from httpx import AsyncClient
from jsonschema import ValidationError, validate

from ..config import settings
from .generation_service import GenerationError, GenerationUnavailableError, strict_json_schema
from .retry import TRANSIENT_STATUSES, retry_after

logger=logging.getLogger(__name__)


def invalid_output(message,draft=None):
    error=GenerationError(message)
    error.repairable=True
    error.cooldown=0
    if draft is not None: error.draft=draft
    return error

# Explicitly documented free chat models, reviewed 2026-10-17. A new model
# requires an operator review; arbitrary paid IDs and CLI impersonation are not
# supported. The provider may still restrict external application access.
OPENCODE_FREE_MODELS=frozenset({
    'big-pickle','glm-5.3-flash-free','deepseek-v4.1-flash-free','space-bunny-free',
    'beam-free','ll-alpha-free','longcat-2.5-preview-free','exo-free',
    'mimo-v2.6-flash-free','mimo-v2.5-free','nemotron-3-ultra-free',
    'nemotron-3.5-lightning-free','nemotron-3.5-super-vl-free',
})


async def generate_free_json(provider,instructions,content,schema):
    converted=strict_json_schema(schema)
    headers={'Content-Type':'application/json'}
    if provider=='openrouter':
        model=settings.OPENROUTER_MODEL
        if not settings.OPENROUTER_API_KEY:
            raise GenerationError('OpenRouter requires OPENROUTER_API_KEY on the backend.')
        if not re.fullmatch(r'[A-Za-z0-9_./:-]{1,160}',model) or not (model=='openrouter/free' or model.endswith(':free')):
            raise GenerationError('OpenRouter is free-only: use openrouter/free or an explicit :free model.')
        url='https://openrouter.ai/api/v1/chat/completions'
        headers.update(Authorization='Bearer '+settings.OPENROUTER_API_KEY,**{'X-OpenRouter-Title':'LabMate'})
        effort=settings.OPENROUTER_REASONING_EFFORT
        if effort not in {'none','minimal','low','medium','high','xhigh','max'}:
            raise GenerationError('OPENROUTER_REASONING_EFFORT is invalid.')
        extra={'response_format':{'type':'json_schema','json_schema':{'name':'labmate_response','strict':True,'schema':converted}},
               'reasoning':{'effort':effort,'exclude':True},
               'provider':{'require_parameters':True,'max_price':{'prompt':0,'completion':0,'request':0}}}
    elif provider=='opencode':
        model=settings.OPENCODE_MODEL
        if model not in OPENCODE_FREE_MODELS:
            raise GenerationError('OpenCode is restricted to the reviewed free chat model IDs.')
        url='https://opencode.ai/inference/openai/v1/chat/completions'
        if settings.OPENCODE_API_KEY: headers['Authorization']='Bearer '+settings.OPENCODE_API_KEY
        # Model support varies; local strict schema validation is mandatory even
        # when the upstream only offers JSON object formatting.
        extra={'response_format':{'type':'json_object'}}
        instructions+='\nReturn one JSON object matching this exact schema, with all fields and no extra keys:\n'+json.dumps(converted)
    else:
        raise GenerationError('Unknown free AI provider.')
    payload={'model':model,'messages':[{'role':'system','content':instructions},{'role':'user','content':content}],
             'temperature':0.2,'max_tokens':max(128,min(settings.FREE_LLM_MAX_TOKENS,16000)),**extra}
    try:
        deadline=max(1,min(settings.FREE_LLM_REQUEST_TIMEOUT,120))
        # HTTPX read timeouts reset after each received chunk. A provider can
        # keep sending whitespace without ever completing its JSON response.
        # Bound the entire request, including receiving the response body.
        async with asyncio.timeout(deadline):
            async with AsyncClient(timeout=deadline,follow_redirects=False) as client:
                response=await client.post(url,headers=headers,json=payload)
    except TimeoutError:
        raise GenerationUnavailableError(provider+' exceeded the total response deadline; the request was stopped.') from None
    except httpx.TransportError:
        raise GenerationUnavailableError(provider+' transport is temporarily unavailable.') from None
    if not response.is_success:
        # Never include raw provider messages: they can echo source or keys.
        transient=response.status_code in TRANSIENT_STATUSES
        error_type=GenerationUnavailableError if transient else GenerationError
        message=f'{provider} rejected the request (HTTP {response.status_code}).'
        if provider=='opencode' and response.status_code==403:
            message='OpenCode denied external application access to its free tier (HTTP 403).'
        elif response.status_code in {401,403}: message+=' Check the backend provider credentials and account permissions.'
        elif response.status_code==402: message+=' Account quota or credits are unavailable; no paid model was selected.'
        elif response.status_code==404: message+=' The selected free model is unavailable.'
        error=error_type(message)
        error.status_code=response.status_code
        error.cooldown=max(settings.LLM_FALLBACK_COOLDOWN_SECONDS,min(retry_after(response),3600)) if transient else 300
        raise error
    try:
        body=response.json()
        if isinstance(body,dict) and body.get('error'):
            upstream=body['error']
            try: status=int(upstream.get('code',502)) if isinstance(upstream,dict) else 502
            except (ValueError,TypeError): status=502
            error=GenerationUnavailableError(provider+' returned an upstream error before producing a complete answer.')
            error.status_code=status
            raise error
        choice=body['choices'][0]
        if choice.get('finish_reason')=='length':
            raise invalid_output(provider+' response exceeded the output limit; incomplete JSON was rejected.')
        if choice['message'].get('refusal'):
            raise GenerationError(provider+' declined this request.')
        result=json.loads(choice['message']['content'])
        validate(result,converted)
    except ValidationError:
        error=invalid_output(provider+' returned a response that does not match the required JSON schema.',result)
        raise error from None
    except (ValueError,TypeError,KeyError,IndexError,AttributeError):
        raise invalid_output(provider+' returned invalid or incomplete JSON.') from None
    returned_model=body.get('model','')
    if isinstance(returned_model,str) and re.fullmatch(r'[A-Za-z0-9_./:-]{1,160}',returned_model):
        logger.info('Free provider %s returned model %s.',provider,returned_model)
    return result
