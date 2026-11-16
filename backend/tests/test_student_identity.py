from app.services.student_identity import align_student_stdin, student_identity_error


QUESTION = "Write a C program using the student name on the report."
PROFILE_NAME = "Vivek Pillai"


def test_c_manual_sample_names_are_replaced_by_the_profile_name():
    code = 'printf("Enter student name: "); scanf("%s", name);'
    for sample in ('Ravi\n', 'Anita\n', 'Ravi Kumar\n78\n92\n'):
        result = align_student_stdin(QUESTION, code, sample, PROFILE_NAME)
        assert result.splitlines()[0] == PROFILE_NAME
        assert result.splitlines()[1:] == sample.splitlines()[1:]


def test_unrelated_and_explicitly_named_records_remain_unchanged():
    code = 'printf("Enter student name: "); scanf("%s", name);'
    assert align_student_stdin('Create three student records.', code, 'Ravi\nAnita\n', PROFILE_NAME) == 'Ravi\nAnita\n'
    assert align_student_stdin(QUESTION + ' Use the student named Anita.', code, 'Anita\n', PROFILE_NAME) == 'Anita\n'
    assert align_student_stdin(QUESTION, code, '3\nRavi\n', PROFILE_NAME) == '3\nRavi\n'


def test_wrong_name_in_source_or_actual_output_fails_verification():
    code = '/* Student Name: Vivek Pillai */\nprintf("Enter student name: ");'
    assert student_identity_error(QUESTION, code, 'Enter student name: \nStudent Name: Ravi\n', PROFILE_NAME)
    assert student_identity_error(QUESTION, code, 'Enter student name: \nStudent Name: Vivek Pillai\n', PROFILE_NAME) == ''
    assert student_identity_error(QUESTION, '/* Student Name: Ravi */', 'Student Name: Vivek Pillai\n', PROFILE_NAME)
    assert student_identity_error('Create three student records.', code, 'Student Name: Ravi\n', PROFILE_NAME) == ''


def test_multiple_output_names_can_include_other_students():
    output = 'Student Name: Anita\nStudent Name: Vivek Pillai\nStudent Name: Ravi\n'
    assert student_identity_error(QUESTION, '', output, PROFILE_NAME) == ''


def test_header_only_identity_does_not_require_console_name():
    question = 'Put your student name in a source header, then print the sum.'
    code = '/* Student Name: Vivek Pillai */\nprintf("Sum: 10\\n");'
    assert student_identity_error(question, code, 'Sum: 10\n', PROFILE_NAME) == ''


def test_two_accounts_keep_their_own_names():
    code = 'printf("Enter student name: "); fgets(name, sizeof(name), stdin);'
    assert align_student_stdin(QUESTION, code, 'Ravi\n', 'Vivek Pillai') == 'Vivek Pillai\n'
    assert align_student_stdin(QUESTION, code, 'Ravi\n', 'Asha Rao') == 'Asha Rao\n'
