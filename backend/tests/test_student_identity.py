from app.services.student_identity import align_student_stdin, identity_question_context, identity_repair_question, student_identity_error


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


def test_shared_manual_identity_requirement_applies_to_each_exercise():
    manual = ('Student: ______\nSupplied data and constraints\n'
              'Use marks out of 100 and the student name on the report.\n'
              'Question 1: Array statistics\nQuestion 2: Structure and grade')
    question = identity_question_context('Question 2: Structure and grade', manual)
    code = '/* Student Name: Vivek Pillai */\nprintf("Enter student name: "); fgets(name, 50, stdin);'
    assert align_student_stdin(question, code, 'Anita\n', PROFILE_NAME) == 'Vivek Pillai\n'
    assert student_identity_error(question, code, 'Student Name: Anita\n', PROFILE_NAME)
    assert student_identity_error(question, code, 'Student Name: Vivek Pillai\n', PROFILE_NAME) == ''


def test_manual_requirement_keeps_explicit_other_student_names():
    question = identity_question_context('Use the student named Anita.', 'Show the student name on the report.')
    code = 'printf("Enter student name: "); fgets(name, 50, stdin);'
    assert align_student_stdin(question, code, 'Anita\n', PROFILE_NAME) == 'Anita\n'


def test_multiple_named_records_still_include_the_profile_student():
    question = identity_question_context(
        'Create records for students named Anita and Ravi, and include your name.',
        'Show the student name on the report.',
    )
    code = 'printf("Enter student name: "); fgets(name, 50, stdin);'
    assert align_student_stdin(question, code, 'Ravi\nAnita\n', PROFILE_NAME) == 'Ravi\nAnita\n'
    output = 'Student Name: Anita\nStudent Name: Vivek Pillai\nStudent Name: Ravi\n'
    assert student_identity_error(question, '', output, PROFILE_NAME) == ''
    assert student_identity_error(question, '', 'Student Name: Anita\nStudent Name: Ravi\n', PROFILE_NAME)
    assert student_identity_error(question, '', 'Student Name: Vivek Pillai\nStudent Name: Ravi\n', PROFILE_NAME)


def test_explicit_other_student_and_own_name_both_required():
    question = identity_question_context(
        'Use the student named Anita and include your name as another record.',
        'Show the student name on the report.',
    )
    code = 'printf("Enter student name: "); fgets(name, 50, stdin);'
    assert align_student_stdin(question, code, 'Anita\n', PROFILE_NAME) == 'Anita\n'
    assert student_identity_error(question, code, 'Student Name: Anita\n', PROFILE_NAME)
    assert student_identity_error(question, code, 'Student Name: Vivek Pillai\n', PROFILE_NAME)
    assert student_identity_error(question, code, 'Student Name: Anita\nStudent Name: Vivek Pillai\n', PROFILE_NAME) == ''


def test_repair_keeps_profile_and_explicit_other_students():
    question = identity_question_context(
        'Create records for students named Anita and Ravi, and include your name.',
        'Show the student name on the report.',
    )
    repair = identity_repair_question(question, PROFILE_NAME)
    assert PROFILE_NAME in repair
    assert 'Anita and Ravi' in repair
    assert 'Read the full name' in repair
    assert identity_repair_question('Print the sum.', PROFILE_NAME) == 'Print the sum.'


def test_completed_c_manual_three_foreign_names_all_fail_verification():
    manual = 'Use marks out of 100 and the student name on the report.'
    for exercise, output in (
        ('Question 1: Array statistics', 'Student Name: Ravi\n'),
        ('Question 2: Structure and grade', 'Student Name: Anita\n'),
        ('Question 3: Boundary validation', 'Student Name: Ravi Kumar\n'),
    ):
        question = identity_question_context(exercise, manual)
        assert student_identity_error(question, '/* Student Name: sheru bhai */', output, 'sheru bhai')
