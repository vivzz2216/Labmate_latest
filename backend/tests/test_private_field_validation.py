import pytest
from app.security.generated_code import validate_generated_code

def test_encapsulated_instance_balance_is_allowed():
    validate_generated_code('class Account:\n def __init__(self): self.__balance = 100\n def balance(self): return self.__balance', 'python')

@pytest.mark.parametrize('source', ['self.__class__', 'self.__dict__', 'self.__getattribute__("secret")', '(1).__class__.__base__'])
def test_runtime_introspection_stays_blocked(source):
    with pytest.raises(ValueError, match='introspection'):
        validate_generated_code(source, 'python')
