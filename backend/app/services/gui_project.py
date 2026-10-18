"""Generate complete Java UI files and bounded declarative component tests together."""
from copy import deepcopy
import json
from jsonschema import validate,ValidationError
from .generation_service import generation_service,GenerationError,strict_json_schema
from .web_project import WEB_SCHEMA,web_requirements
from .browser_scenarios import normalize_v2,validate_coverage_plan
from .java_gui_runtime import GUI_ACTIONS,validate_gui_project,normalize_gui_tests
from .evidence_planner import experiment_category
from .source_evidence import source_capture_plan


GUI_SCHEMA={'type':'OBJECT','properties':{
    key:deepcopy(WEB_SCHEMA['properties'][key]) for key in ('answer','files','entrypoint','source_capture_files')}}
GUI_SCHEMA['properties']['readme']={'type':'STRING'}
GUI_SCHEMA['properties']['gui_tests']=deepcopy(WEB_SCHEMA['properties']['browser_tests'])
GUI_SCHEMA['properties']['gui_tests']['items']['properties']['steps']['items']['properties']['action']['enum']=sorted(GUI_ACTIONS)
GUI_SCHEMA['required']=list(GUI_SCHEMA['properties'])
GUI_INSTRUCTIONS='''Return complete executable educational Java AWT or Swing source and its declarative GUI tests in one JSON response.
Implement the exact assignment, including actual event listeners and validation. Never substitute console output or a web page for a Java GUI.
Use a public class with a public static main method. Supply all Java files. Prefer SwingUtilities.invokeLater for Swing construction; set a usable window size, show the window and keep output labels wide enough for their text. Do not require Maven, external dependencies, JavaFX or external services.
Use standard layout managers. Assign stable Component.setName identifiers to editable controls and output components; Swing labels may also use setLabelFor.
Tests are declarative; never supply Java test code or executable scripts. Use locator_type=testid with the exact setName value for fill/select; click by role button with its exact text or by testid. Every step has action, locator_type, locator, role and value. For assert_visible/assert_absent put required visible text in locator, locator_type=text, and leave role/value empty. screenshot uses locator_type=page and empty locator/role/value. Tests include viewport width=960 height=640 as metadata; the application controls the actual window dimensions.
For a two-number addition assignment, test 2 and 3 -> click Add -> visible 5. Derive other expected results from the requested operation. Preserve the manual's exact samples, expected values and control labels over this example. Test both valid and invalid states when required. Show results in the actual GUI; JOptionPane dialogs are supported. Do not test exit/System.exit or external desktop apps. Keep plans short and cover all required behavior IDs. Do not assert a pre-existing label as proof of an interaction.
source_capture_files selects at most three real Java implementation files. The host shows clearly labelled excerpts for long code. Include actual javac/java startup instructions in readme. No fabricated execution claims, testing badges, terminal decoration or passing status in source.
'''


async def generate_gui_project(question,language,on_retry=None,previous=None,failure='',additional_instructions=''):
    requirements=web_requirements(question+'\n'+additional_instructions,'java')
    prompt='Original complete experiment:\n'+question+'\nAdditional instructions:\n'+additional_instructions+'\nRequirement contract:\n'+json.dumps(requirements)
    if failure:prompt+='\nActual previous failure to fix in complete replacement files/tests:\n'+failure[:4000]
    if previous:prompt+='\nPrevious entrypoint: '+str(previous.get('entrypoint',''))[:160]
    raw=await generation_service.generate_json(GUI_INSTRUCTIONS,prompt,GUI_SCHEMA,on_retry=on_retry)
    try:
        validate(raw,strict_json_schema(GUI_SCHEMA))
        config={'project_files':{f['path']:f['content'] for f in raw['files']},'entrypoint':raw['entrypoint']}
        if len(config['project_files'])!=len(raw['files']):raise ValueError('Duplicate Java GUI filenames.')
        validate_gui_project(config)
        code=config['project_files'][config['entrypoint']]
        kind=experiment_category('java',question,code)
        if kind not in {'java_awt','java_swing'}:raise ValueError('This adapter supports actual AWT and Swing applications.')
        plans=normalize_gui_tests([{**p,'version':2} for p in raw['gui_tests']])
        validate_coverage_plan(requirements,plans)
        source_capture_plan(config['project_files'],code,config['entrypoint'],'java_gui',raw['source_capture_files'])
        config['project_files']['README.md']=raw['readme']
        config.update(project_type=kind,gui_tests=plans,source_capture_files=raw['source_capture_files'],requirements=requirements,source_checks={})
        return raw,config
    except (ValidationError,ValueError,KeyError,TypeError) as error:
        failure=GenerationError('Invalid Java UI project: '+str(error)[:1500]);failure.project_data=raw;raise failure from None
