"""Trusted, reproducible capability fixtures. No fixture accesses user files or the internet."""

def action(kind, locator, value='', role=''):
    return {'action': kind, 'locator_type': 'role' if role else 'label', 'locator': locator, 'role': role, 'value': value}

def browser_test(name, actions, expected, viewport=None):
    result = {'name': name, 'actions': actions, 'expected_text': [expected]}
    if viewport: result['viewport'] = viewport
    return result

def fixture(name, language, code, expected='', stdin=None, **extra):
    return dict(id=name, language=language, code=code, expected=expected, stdin=stdin, **extra)

def console_cases():
    cases=[]
    python=[
      ('io','n=int(input())\nprint(n*2)','14','7\n'),
      ('conditions','n=5\nprint("positive" if n>0 else "negative")','positive',None),
      ('loops','print(sum(range(1,6)))','15',None),
      ('functions','def square(n): return n*n\nprint(square(6))','36',None),
      ('collections','d={"a":2,"b":3}\nprint(sum(d.values())+sum([1,2]))','8',None),
      ('classes','class Base:\n def __init__(self): self.value=9\nclass Child(Base):\n def __init__(self): super().__init__()\nprint(Child().value)','9',None),
      ('exceptions','try:\n print(1/0)\nexcept ZeroDivisionError:\n print("handled")','handled',None),
      ('file','with open("audit.txt","w") as f: f.write("42")\nwith open("audit.txt") as f: print(f.read())','42',None),
    ]
    for name,code,out,stdin in python: cases.append(fixture('python_'+name,'python',code,out,stdin))
    for lang in ('c','cpp'):
      bodies=[('hello','printf("hello");','hello',None),('io','int n;scanf("%d",&n);printf("%d",n*2);','14','7\n'),
              ('conditions','int n=3;printf("%s",n>0?"positive":"negative");','positive',None),
              ('loops','int n=0;for(int i=1;i<=5;i++)n+=i;printf("%d",n);','15',None),
              ('arrays','int a[]={2,4,6};printf("%d",a[0]+a[1]+a[2]);','12',None),
              ('strings','char s[]="lab";printf("%d",(int)strlen(s));','3',None),
              ('pointers','int n=8;int *p=&n;*p+=2;printf("%d",n);','10',None),
              ('structures','struct S{int n;};struct S s={9};printf("%d",s.n);','9',None)]
      for name,body,out,stdin in bodies:
        cases.append(fixture(lang+'_'+name,lang,'#include <stdio.h>\n#include <string.h>\nint main(){'+body+'return 0;}',out,stdin))
      cases.append(fixture(lang+'_functions',lang,'#include <stdio.h>\nint square(int n){return n*n;}\nint main(){printf("%d",square(6));return 0;}','36'))
      cases.append(fixture(lang+'_compile_error',lang,'int main(){ invalid syntax }', failure='compile'))
      cases.append(fixture(lang+'_runtime_error',lang,'int main(){return 3;}',failure='runtime'))
    cases.append(fixture('cpp_inheritance','cpp','#include <iostream>\nclass Base{public:int value=11;};class Child:public Base{};int main(){Child c;std::cout<<c.value;}','11'))
    java=[('hello','System.out.print("hello");','hello'),('operators','System.out.print(2+3*4);','14'),
          ('conditions','System.out.print(3>0?"positive":"negative");','positive'),
          ('loops','int n=0;for(int i=1;i<=5;i++)n+=i;System.out.print(n);','15'),
          ('arrays','int[] a={2,4,6};System.out.print(a[0]+a[1]+a[2]);','12'),
          ('methods','System.out.print(square(6));','36'),
          ('oop','System.out.print(new Child().value);','11'),
          ('exception','try{int a=1/Integer.parseInt("0");}catch(ArithmeticException e){System.out.print("handled");}','handled'),
          ('file','java.nio.file.Files.writeString(java.nio.file.Path.of("audit.txt"),"42");System.out.print(java.nio.file.Files.readString(java.nio.file.Path.of("audit.txt")));','42')]
    for name,body,out in java:
      code='class Base{int value=11;}class Child extends Base{} public class Main{static int square(int n){return n*n;}public static void main(String[] args) throws Exception{'+body+'}}'
      cases.append(fixture('java_'+name,'java',code,out))
    cases.append(fixture('java_io','java','import java.util.Scanner;public class Main{public static void main(String[]args){Scanner s=new Scanner(System.in);System.out.print(s.nextInt()*2);}}','14','7\n'))
    node=[('console',"console.log('hello')",'hello'),('file',"const fs=require('fs');fs.writeFileSync('audit.txt','42');console.log(fs.readFileSync('audit.txt','utf8'));",'42'),
          ('error',"try{throw new Error('test')}catch(e){console.log('handled')}",'handled')]
    for name,code,out in node: cases.append(fixture('node_'+name,'node',code,out))
    cases += [fixture('python_runtime_error','python','print(1/0)',failure='runtime'),
              fixture('node_runtime_error','node',"throw new Error('intentional')",failure='runtime'),
              fixture('python_timeout','python','while True: pass',failure='timeout',timeout=.25)]
    return cases

def gui_cases():
    cases=[]
    for variant in ('button','label_change','form','login_validation','calculator'):
      swing='import javax.swing.*;public class Main{public static void main(String[]a){JFrame f=new JFrame("Audit");f.add(new JButton("Run"));f.setSize(300,200);f.setVisible(true);}}'
      tk='import tkinter as tk\nroot=tk.Tk()\ntk.Button(root,text="Run").pack()\nroot.mainloop()'
      cases.append(fixture('swing_'+variant,'java',swing,failure='missing_gui_plan',objective='Create a Swing '+variant))
      cases.append(fixture('tkinter_'+variant,'python',tk,blocked='tkinter',objective='Create a Tkinter '+variant))
    cases.append(fixture('awt_button','java','import java.awt.*;public class Main{public static void main(String[]a){Frame f=new Frame("Audit");f.add(new Button("Run"));f.setSize(300,200);f.setVisible(true);}}',failure='missing_gui_plan'))
    cases.append(fixture('javafx_window','java','import javafx.application.Application;import javafx.stage.Stage;public class Main extends Application{public void start(Stage stage){stage.show();}public static void main(String[]args){launch(args);}}',blocked='javafx'))
    for name in ('homepage','template','form','server_validation','routes'):
      cases.append(fixture('flask_'+name,'python','from flask import Flask\napp=Flask(__name__)\n@app.route("/")\ndef home(): return "Hello"\napp.run()',failure='missing_flask_project'))
    return cases

def web_cases():
    cases=[]
    def page(name,html,actions,expected,**extra):
      cases.append(fixture('html_'+name,'html',html,expected,browser_tests=[browser_test(name,actions,expected)],**extra))
    click=lambda name:action('click',name,role='button')
    page('registration','<label>Name<input id="n"></label><button onclick="document.querySelector(\'output\').textContent=\'Welcome \'+document.querySelector(\'input\').value">Register</button><output></output>',[action('fill','Name','Student'),click('Register')],'Welcome Student')
    page('validation','<label>Email<input id="e"></label><button onclick="document.querySelector(\'output\').textContent=document.querySelector(\'input\').value.includes(\'@\')?\'Accepted\':\'Invalid email\'">Submit</button><output></output>',[action('fill','Email','bad'),click('Submit')],'Invalid email')
    page('navigation','<button onclick="document.querySelector(\'nav\').hidden=false">Menu</button><nav hidden>Courses</nav>',[click('Menu')],'Courses')
    page('modal','<button onclick="document.querySelector(\'dialog\').showModal()">Open</button><dialog>Dialog content</dialog>',[click('Open')],'Dialog content')
    page('tabs','<button onclick="document.querySelector(\'output\').textContent=\'Tab two content\'">Second tab</button><output>First tab</output>',[click('Second tab')],'Tab two content')
    page('todo','<label>Task<input></label><button onclick="document.querySelector(\'ul\').textContent=document.querySelector(\'input\').value">Add task</button><ul></ul>',[action('fill','Task','Review evidence'),click('Add task')],'Review evidence')
    page('filter','<label>Query<input></label><button onclick="document.querySelector(\'output\').textContent=document.querySelector(\'input\').value===\'py\'?\'Python found\':\'No match\'">Search</button><output></output>',[action('fill','Query','py'),click('Search')],'Python found')
    page('dom','<button onclick="document.querySelector(\'output\').textContent=\'Updated\'">Change</button><output></output>',[click('Change')],'Updated')
    responsive='<style>.mobile{display:none}@media(max-width:480px){.desktop{display:none}.mobile{display:block}}</style><div class="mobile">Mobile layout</div><div class="desktop">Desktop layout</div><button onclick="document.querySelector(\'output\').textContent=innerWidth<481?\'Mobile confirmed\':\'Desktop confirmed\'">Inspect</button><output></output>'
    cases.append(fixture('html_responsive','html',responsive,browser_tests=[browser_test('desktop',[click('Inspect')],'Desktop confirmed'),browser_test('mobile',[click('Inspect')],'Mobile confirmed',{'width':390,'height':844})]))
    multi={'index.html':'<link rel="stylesheet" href="style.css"><button>Run</button><output></output><script src="app.js"></script>',
           'style.css':'body{font-family:sans-serif;color:#123456}',
           'app.js':"document.querySelector('button').onclick=async()=>{const r=await fetch('/data.json');const d=await r.json();document.querySelector('output').textContent=d.message;}",
           'data.json':'{"message":"Controlled response"}','about.html':'<h1>About this lab</h1>'}
    cases.append(fixture('html_fetch_multifile','html',multi['index.html'],project_files=multi,browser_tests=[browser_test('fetch',[click('Run')],'Controlled response')]))
    cases.append(fixture('html_multi_page','html','<h1>Home</h1>',project_files={'index.html':'<h1>Home</h1>','about.html':'<h1>About this lab</h1>'},routes=['/','/about.html']))
    for name,source,expected in [
      ('counter',"const [n,setN]=React.useState(0);return <><button onClick={()=>setN(n+1)}>Run</button><output>{n>0?'Count '+n:''}</output></>",'Count 1'),
      ('todo',"const [s,setS]=React.useState('');return <><button onClick={()=>setS('Task added')}>Run</button><output>{s}</output></>",'Task added'),
      ('form',"const [s,setS]=React.useState('');return <><button onClick={()=>setS('Validation error')}>Run</button><output>{s}</output></>",'Validation error'),
      ('search',"const [s,setS]=React.useState('');return <><button onClick={()=>setS('Python match')}>Run</button><output>{s}</output></>",'Python match'),
      ('dashboard',"const [s,setS]=React.useState('');return <><article>Summary card</article><button onClick={()=>setS('Dashboard updated')}>Run</button><output>{s}</output></>",'Dashboard updated'),
      ('navigation',"const [s,setS]=React.useState('');return <><button onClick={()=>setS('Page two')}>Run</button><output>{s}</output></>",'Page two')]:
      app="import React from 'react';export default function App(){"+source+'}'
      files={'src/App.jsx':app,'src/Helper.jsx':"export default function Helper(){return <small>Local component</small>}",'package.json':'{"scripts":{"postinstall":"UNTRUSTED"},"dependencies":{"evil-package":"*"}}'}
      if name=='navigation':files['src/App.jsx']=app.replace("import React from 'react';","import React from 'react';import Helper from './Helper';").replace("return <>","return <><Helper/>")
      cases.append(fixture('react_'+name,'react',app,expected,project_files=files,browser_tests=[browser_test(name,[click('Run')],expected)]))
    return cases

def api_cases():
    code="""const express=require('express');const app=express();app.use(express.json());app.get('/health',(req,res)=>res.json({ok:true}));app.post('/sum',(req,res)=>{if(typeof req.body.a!=='number'||typeof req.body.b!=='number')return res.status(400).json({error:'numbers required'});res.json({result:req.body.a+req.body.b});});app.get('/broken',(req,res)=>res.status(500).json({error:'intentional'}));app.listen(3000);"""
    return [fixture('node_rest_validation','node',code,api_tests=[
        {'name':'health','path':'/health','expected_status':200,'expected_json':{'ok':True}},
        {'name':'sum','method':'POST','path':'/sum','json':{'a':2,'b':3},'expected_status':200,'expected_json':{'result':5}},
        {'name':'invalid input','method':'POST','path':'/sum','json':{},'expected_status':400,'expected_json':{'error':'numbers required'}},
        {'name':'error handling','path':'/broken','expected_status':500,'expected_json':{'error':'intentional'}},
        {'name':'missing route','path':'/missing','expected_status':404}]),
      fixture('node_http','node',"const http=require('http');http.createServer((req,res)=>res.end('Actual HTTP result')).listen(3000);",'Actual HTTP result')]

def all_cases():
    return console_cases()+gui_cases()+web_cases()+api_cases()
