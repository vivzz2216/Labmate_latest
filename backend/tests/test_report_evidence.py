from app.services.report_evidence import browser_captures


def test_final_capture_is_redundant_only_after_last_successful_state_change():
    paths=['test_1_step_2.png','test_1.png']
    verification={'tests':[{'name':'Add','status':'passed','steps':[
        {'action':'click'},{'action':'screenshot'},{'action':'assert_visible'}]}]}
    chosen=browser_captures(paths,verification)
    assert [item['path'] for item in chosen]==paths[:1]
    assert 'Add' in chosen[0]['caption']
    verification['tests'][0]['steps'].append({'action':'click'})
    assert [item['path'] for item in browser_captures(paths,verification)]==paths


def test_missing_or_failed_verification_retains_diagnostic_final_frame():
    paths=['test_1_step_2.png','test_1.png']
    for verification in [None,{'tests':[]},{'tests':[{'status':'passed'}]},
            {'tests':[{'status':'failed','steps':[{'action':'click'},{'action':'screenshot'}]}]}]:
        assert [item['path'] for item in browser_captures(paths,verification)]==paths
