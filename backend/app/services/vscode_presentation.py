"""Dark Modern source presentation; never claims native IDE execution."""
from pathlib import PurePosixPath
from pathlib import Path
from functools import lru_cache
import base64,json
from pygments.style import Style
from pygments.token import Comment,Error,Generic,Keyword,Name,Number,Operator,Punctuation,String,Text


class DarkModern(Style):
    background_color='#1f1f1f'
    default_style=''
    styles={Text:'#d4d4d4',Comment:'#6a9955',Keyword:'#c586c0',Keyword.Declaration:'#569cd6',
        Keyword.Type:'#569cd6',Keyword.Constant:'#569cd6',Name:'#9cdcfe',Name.Class:'#4ec9b0',
        Name.Function:'#dcdcaa',Name.Tag:'#569cd6',Name.Attribute:'#9cdcfe',Name.Builtin:'#dcdcaa',
        Name.Decorator:'#dcdcaa',String:'#ce9178',String.Doc:'#6a9955',Number:'#b5cea8',
        Operator:'#d4d4d4',Punctuation:'#d4d4d4',Generic:'#d4d4d4',Error:'#f44747'}


def file_kind(name):
    return {'.py':'python','.java':'java','.html':'html','.css':'css','.js':'javascript',
        '.cjs':'javascript','.mjs':'javascript','.jsx':'react','.json':'json','.md':'markdown'}.get(PurePosixPath(name).suffix.lower(),'file')


def explorer_rows(files,current):
    tree={}
    for name in files:
        node=tree
        parts=PurePosixPath(name).parts
        for part in parts[:-1]:node=node.setdefault(part,{})
        node[parts[-1]]=name
    rows=[]
    def walk(node,depth):
        for name,value in sorted(node.items(),key=lambda item:(not isinstance(item[1],dict),item[0].lower())):
            folder=isinstance(value,dict)
            rows.append({'name':name,'depth':depth,'folder':folder,'current':value==current,
                'kind':'folder' if folder else file_kind(value),
                'symbol':{} if folder else assets()['files'].get(file_kind(value),assets()['files']['default'])})
            if folder:walk(value,depth+1)
    walk(tree,0)
    return rows


def indentation(source):
    sizes=[len(line)-len(line.lstrip(' ')) for line in source.splitlines() if line.startswith(' ') and line.strip()]
    return min(sizes) if sizes and min(sizes)<=8 else 4


@lru_cache(maxsize=1)
def assets():
    root=Path(__file__).parents[1]/'public'
    data=json.loads((root/'vscode-icons.json').read_text())
    aliases={'branch':'source-control','debug':'debug-alt','gear':'settings-gear','minimize':'chrome-minimize',
        'maximize':'chrome-maximize','chevron':'chevron-right','down':'chevron-down','panel':'layout-panel','split':'split-horizontal'}
    data['symbols']={key:data['codicons'][aliases.get(key,key)] for key in ['files','search','branch','debug','extensions','account','gear','close','minimize','maximize','chevron','down','ellipsis','layout','panel','split','remote','bell']}
    data['codicon_font']=base64.b64encode((root/'codicon.ttf').read_bytes()).decode('ascii')
    data['seti_font']=base64.b64encode((root/'seti.woff').read_bytes()).decode('ascii')
    return data
