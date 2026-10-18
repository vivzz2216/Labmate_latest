import json
import tempfile
import unittest
from unittest.mock import patch

from app.config import settings
from app.services.runtime_engine import runtime_engine


class FullstackRuntimeTests(unittest.IsolatedAsyncioTestCase):
    async def test_separate_react_express_requests_validation_and_clean_state(self):
        files = {
            'index.html': '<div id="root"></div><script type="module" src="/src/main.jsx"></script>',
            'src/main.jsx': "import React from 'react';import{createRoot}from'react-dom/client';import App from './App.jsx';createRoot(document.getElementById('root')).render(<App/>);",
            'src/App.jsx': """import{useState,useEffect}from'react';import './App.css';
export default function App(){const[events,setEvents]=useState([]),[title,setTitle]=useState('');
useEffect(()=>{fetch('/api/events').then(r=>r.json()).then(setEvents)},[]);
async function add(e){e.preventDefault();const r=await fetch('/api/events',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title})});const item=await r.json();if(r.ok)setEvents([...events,item]);}
return <main><form onSubmit={add}><label htmlFor="title">Event title</label><input id="title" value={title} onChange={e=>setTitle(e.target.value)}/><button>Add event</button></form><ul>{events.map(e=><li key={e.id}>{e.title}</li>)}</ul></main>}
""",
            'src/App.css': 'body{font:18px Arial;margin:32px}input,button{padding:10px}',
            'server.cjs': """const express=require('express');const app=express();app.use(express.json());const events=[];
app.get('/api/events',(req,res)=>res.json(events));app.post('/api/events',(req,res)=>{if(typeof req.body.title!=='string'||!req.body.title.trim())return res.status(400).json({error:'Title required'});const item={id:events.length+1,title:req.body.title.trim()};events.push(item);res.status(201).json(item)});app.listen(process.env.PORT);""",
        }
        def step(action, locator='',value='',kind='page',role=''):
            return dict(action=action,locator_type=kind,locator=locator,role=role,value=value)
        tests=[{'version':2,'name':'Browser adds event through actual API','requirement_ids':[],
            'viewport':{'width':1366,'height':768},'steps':[
                step('fill','Event title','Browser event','label'),step('click','Add event','','role','button'),
                step('assert_visible','Browser event','','text'),
                step('assert_http',value=json.dumps({'method':'POST','path':'/api/events','status':201})),
                step('assert_http',value=json.dumps({'method':'GET','path':'/api/events','status':200}))]}]
        config=dict(project_files=files,project_type='fullstack',entrypoint='src/App.jsx',server_entrypoint='server.cjs',browser_tests=tests,
            api_tests=[{'name':'Clean initial state','path':'/api/events','method':'GET','expected_status':200,'expected_json':[]},
                {'name':'Reject blank','path':'/api/events','method':'POST','json':{},'expected_status':400,'expected_json':{'error':'Title required'}},
                {'name':'Add through API','path':'/api/events','method':'POST','json':{'title':'API event'},'expected_status':201,'expected_json':{'id':1,'title':'API event'}},
                {'name':'Persistence within server run','path':'/api/events','method':'GET','expected_status':200,'expected_json':[{'id':1,'title':'API event'}]}])
        with tempfile.TemporaryDirectory() as folder,patch.object(settings,'REACT_TEMP_DIR',folder+'/run'),patch.object(settings,'SCREENSHOT_DIR',folder+'/screenshots'):
            result=await runtime_engine.execute(files['src/App.jsx'],'node',project_files=files,project_config=config,browser_tests=tests,interaction_is_required=True,objective='React frontend with Express API; database optional.')
            self.assertTrue(result.success,result.error)
            self.assertEqual(result.verification['kind'],'fullstack')
            self.assertEqual(result.verification['api_verification']['status'],'passed')
            self.assertTrue(result.screenshots)
