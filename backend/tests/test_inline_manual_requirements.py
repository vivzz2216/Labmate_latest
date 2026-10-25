import pytest
from app.services.manual_sections import numbered_experiments, ManualStructureError


@pytest.mark.parametrize('title,body,language',[
    ('HTML task board','Build an HTML task board with validation and persistence.','html'),
    ('React routes','Create a React application with dynamic routes.','react'),
    ('AVL rotations','Write a C11 program implementing AVL rotations.','c'),
    ('C programming','Implement AVL insertion using C programming.','c'),
])
def test_inline_actionable_aim_is_a_complete_requirement(title,body,language):
    text=f'Experiment 9: {title}\nAim: {body}'
    tasks=numbered_experiments(text)
    assert len(tasks)==1 and tasks[0]['id']==9 and tasks[0]['language']==language
    assert tasks[0]['text']==text


def test_non_actionable_aim_still_requires_a_problem_statement():
    with pytest.raises(ManualStructureError):
        numbered_experiments('Experiment 9: Trees\nAim: Understand tree terminology.')
