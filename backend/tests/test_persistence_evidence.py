from copy import deepcopy
import pytest
from app.services.browser_scenarios import validate_coverage_plan,validate_run_coverage

REQ=[{'id':'persistence','kind':'behavior'}]
def sample():
    steps=[{'action':a,'locator_type':k,'locator':loc,'role':'','value':v} for a,k,loc,v in [
        ('click','testid','add-graphs',''),('assert_count','testid','favourite-item','1'),
        ('reload','page','',''),('assert_count','testid','favourite-item','1')]]
    return {'status':'passed','requirement_ids':['persistence'],'steps':steps,
        'assertions':[{'step':i,'action':'assert_count','expected':'1','changed':True} for i in [2,4]],
        'mutations':[{'step':1,'action':'click'},{'step':3,'action':'reload'}]}

def test_favourite_button_can_prove_persistence_without_typing():
    t=sample();validate_coverage_plan(REQ,[t]);validate_run_coverage(REQ,{'tests':[t]})

@pytest.mark.parametrize('bad',['unchanged','other_target','other_expected','missing_after'])
def test_render_only_or_unrelated_state_does_not_prove_persistence(bad):
    t=deepcopy(sample())
    if bad=='unchanged':t['assertions'][0]['changed']=False
    if bad=='other_target':t['steps'][3]['locator']='unrelated-list'
    if bad=='other_expected':t['assertions'][1]['expected']='2'
    if bad=='missing_after':t['assertions'].pop()
    with pytest.raises(ValueError,match='persistence'):validate_run_coverage(REQ,{'tests':[t]})

def test_reload_and_visible_content_alone_is_not_a_persistence_test():
    t=sample();t['steps']=[s for s in t['steps'] if s['action']!='click']
    with pytest.raises(ValueError,match='persistence'):validate_coverage_plan(REQ,[t])
