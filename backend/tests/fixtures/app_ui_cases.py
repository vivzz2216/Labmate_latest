def step(action,locator='',value='',kind='page',role=''):
    return dict(action=action,locator_type=kind,locator=locator,role=role,value=value)


def scenario(name,steps,ids=None):
    return dict(version=2,name=name,steps=steps,requirement_ids=ids or [],viewport={'width':960,'height':640})


FLASK_FILES={
 'app.py':'''from flask import Flask, request, render_template

app = Flask(__name__)

@app.get('/')
def index():
    return render_template('index.html', result='', error='')

@app.post('/add')
def add():
    try:
        first = int(request.form.get('first', ''))
        second = int(request.form.get('second', ''))
    except ValueError:
        return render_template('index.html', result='', error='Enter two integers'), 400
    return render_template('index.html', result=str(first + second), error='')
''',
 'templates/index.html':'''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Flask addition lab</title>
<link rel="stylesheet" href="{{ url_for('static', filename='styles.css') }}"></head>
<body><main><h1>Flask addition lab</h1><p>Add two integers using a server-side Python route.</p>
<form action="/add" method="post"><label for="first">First number</label><input id="first" name="first">
<label for="second">Second number</label><input id="second" name="second"><button>Add</button></form>
<output aria-live="polite">{{ result }}</output><p role="alert">{{ error }}</p></main></body></html>''',
 'static/styles.css':'body{margin:0;background:#edf1f5;color:#172536;font:18px/1.6 Arial,sans-serif}main{max-width:600px;margin:60px auto;padding:32px;background:white}label,input,button{display:block}input{font:inherit;margin:4px 0 20px;padding:8px}button{font:inherit;padding:8px 24px;background:#174c72;color:white;border:0}output{display:block;font-size:32px;margin-top:20px}',
 'README.md':'Install Flask==3.1.3. Run flask --app app run.'}

FLASK_TESTS=[
 scenario('Add two integers through the Flask route',[
    step('fill','First number','2','label'),step('fill','Second number','3','label'),
    step('click','Add','','role','button'),step('assert_visible','5','','text'),
    step('assert_http',value='{"method":"POST","path":"/add","status":200}'),step('screenshot')],['calculation','api']),
 scenario('Reject invalid input on the server',[
    step('fill','First number','abc','label'),step('fill','Second number','3','label'),
    step('click','Add','','role','button'),step('assert_visible','Enter two integers','','text'),
    step('assert_http',value='{"method":"POST","path":"/add","status":400}'),step('screenshot')],['validation','api'])]

SWING_SOURCE='''import javax.swing.*;
import java.awt.*;

public class Calculator {
    public static void main(String[] args) {
        SwingUtilities.invokeLater(() -> {
            JFrame frame = new JFrame("Java addition lab");
            frame.setDefaultCloseOperation(JFrame.DISPOSE_ON_CLOSE);
            JPanel panel = new JPanel(new GridLayout(0, 1, 8, 8));
            panel.setBorder(BorderFactory.createEmptyBorder(24, 28, 24, 28));
            JTextField first = new JTextField(); first.setName("first");
            JTextField second = new JTextField(); second.setName("second");
            JLabel result = new JLabel("Result will appear here.");
            result.setName("result");
            JButton add = new JButton("Add");
            panel.add(new JLabel("First number")); panel.add(first);
            panel.add(new JLabel("Second number")); panel.add(second);
            panel.add(add); panel.add(result);
            add.addActionListener(event -> {
                try {
                    result.setText(String.valueOf(Integer.parseInt(first.getText()) + Integer.parseInt(second.getText())));
                } catch (NumberFormatException error) {
                    result.setText("Enter two integers");
                }
            });
            frame.setContentPane(panel);
            frame.setSize(560, 390);
            frame.setLocation(24, 24);
            frame.setVisible(true);
        });
    }
}
'''

AWT_SOURCE='''import java.awt.*;
public class Calculator {
    public static void main(String[] args) {
        EventQueue.invokeLater(() -> {
            Frame frame = new Frame("AWT addition lab");
            frame.setLayout(new GridLayout(0,1,8,8));
            TextField first = new TextField(); first.setName("first");
            TextField second = new TextField(); second.setName("second");
            Label result = new Label("Result will appear here.");
            Button add = new Button("Add");
            frame.add(new Label("First number")); frame.add(first);
            frame.add(new Label("Second number")); frame.add(second);
            frame.add(add); frame.add(result);
            add.addActionListener(event -> {
                try { result.setText(String.valueOf(Integer.parseInt(first.getText()) + Integer.parseInt(second.getText()))); }
                catch (NumberFormatException error) { result.setText("Enter two integers"); }
            });
            frame.setSize(560,390); frame.setLocation(24,24); frame.setVisible(true);
        });
    }
}
'''

GUI_TESTS=[
 scenario('Add 2 and 3 in the actual Java UI',[
    step('fill','first','2','testid'),step('fill','second','3','testid'),
    step('click','Add','','role','button'),step('assert_visible','5','','text'),step('screenshot')],['calculation']),
 scenario('Show invalid integer feedback',[
    step('fill','first','abc','testid'),step('fill','second','3','testid'),
    step('click','Add','','role','button'),step('assert_visible','Enter two integers','','text'),step('screenshot')],['validation'])]
