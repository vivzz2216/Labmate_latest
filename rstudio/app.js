(function(){
'use strict';
var KEYWORDS=/^(?:if|else|for|while|repeat|function|return|break|next|in)$/;
var CONSTANTS=/^(?:TRUE|FALSE|NULL|NA|NA_integer_|NA_real_|NA_character_|Inf|NaN|T|F)$/;
var TOKEN=/(#[^\n]*)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|(`[^`]*`)|(0[xX][0-9a-fA-F]+L?|(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?[Li]?)|([A-Za-z.][A-Za-z0-9._]*)|(<<-|<-|->>|->|\|>|%[^%\n]*%|==|!=|<=|>=|&&|\|\||[-+*\/^=<>!&|~:$@])/g;

function esc(t){return String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
function highlight(line){
  var out='',last=0,m;TOKEN.lastIndex=0;
  while((m=TOKEN.exec(line))){
    out+=esc(line.slice(last,m.index));last=TOKEN.lastIndex;
    var t=m[0],cls='';
    if(m[1])cls='c';else if(m[2])cls='s';else if(m[3])cls='';else if(m[4])cls='n';
    else if(m[5]){
      if(KEYWORDS.test(t))cls='k';else if(CONSTANTS.test(t))cls='const';
      else if(/^\s*\(/.test(line.slice(last)))cls='f';
    }else if(m[6])cls='o';
    out+=cls?'<span class="'+cls+'">'+esc(t)+'</span>':esc(t);
  }
  return out+esc(line.slice(last));
}
function $(id){return document.getElementById(id);}
function setTabs(el,active,names){
  var html='';
  names.forEach(function(n){html+='<span class="tab'+(n.id===active?' active':'')+'">'+esc(n.label)+(n.close?' <b>&#10005;</b>':'')+'</span>';});
  el.innerHTML=html;
}
function sizeText(n){return n<1024?n+' B':(n/1024).toFixed(1)+' KB';}

function renderSource(d){
  var views=d.views||[],activeView=d.activeView!=null?d.activeView:-1;
  var tabs=[{id:'script',label:d.file.name,close:true}];
  views.forEach(function(v,i){tabs.push({id:'v'+i,label:v.title,close:true});});
  setTabs($('source-tabs'),activeView>=0?'v'+activeView:'script',tabs);
  var editor=$('editor'),viewer=$('viewer');
  if(activeView>=0&&views[activeView]){
    editor.style.display='none';viewer.hidden=false;
    var v=views[activeView],h='<div class="vwbar"><span class="btn">&#9638; Filter</span><span>Rows 1&ndash;'+v.rows.length+' of '+v.nrow+'</span><span>Cols 1&ndash;'+v.cols.length+' of '+v.ncol+'</span></div><div style="overflow:hidden;flex:1"><table class="grid"><thead><tr><th class="rn"></th>';
    v.cols.forEach(function(c){h+='<th>'+esc(c)+'</th>';});
    h+='</tr></thead><tbody>';
    v.rows.forEach(function(r,ri){h+='<tr><td class="rn">'+esc(v.rowNames[ri])+'</td>';r.forEach(function(x,ci){h+='<td class="'+(v.numeric[ci]?'num':'')+'">'+esc(x)+'</td>';});h+='</tr>';});
    viewer.innerHTML=h+'</tbody></table></div>';
    $('cursor-pos').textContent='1:1';
    return;
  }
  viewer.hidden=true;editor.style.display='flex';
  var lines=d.file.code.split('\n');if(lines.length&&lines[lines.length-1]==='')lines.pop();
  var first=d.firstLine||1,last=d.lastLine||Math.min(lines.length,first+21);
  var cursor=d.cursorLine||last,g='',c='';
  for(var i=first;i<=last&&i<=lines.length;i++){
    var on=i===cursor?' class="on"':'';
    g+='<div'+on+'>'+i+'</div>';c+='<div'+on+'>'+(highlight(lines[i-1])||'&nbsp;')+'</div>';
  }
  $('gutter').innerHTML=g;$('code').innerHTML=c;
  var cl=lines[cursor-1]||'';$('cursor-pos').textContent=cursor+':'+(cl.length+1);
}

function renderConsole(d){
  var h='';
  (d.console||[]).forEach(function(l){
    if(l.k==='cmd')h+='<div class="cmd">'+esc(l.prompt+l.text)+'</div>';
    else if(l.k==='prompt')h+='<div class="cmd">&gt; </div>';
    else h+='<div class="'+(l.k==='err'?'err':l.k==='warn'?'warn':l.k==='msg'?'msg':'')+'">'+(esc(l.text)||'&nbsp;')+'</div>';
  });
  $('console').innerHTML=h;
}

function renderEnv(d){
  var tab=d.envTab||'environment',body=$('env-body');
  setTabs($('env-tabs'),tab,[{id:'environment',label:'Environment'},{id:'history',label:'History'},{label:'Connections'},{label:'Tutorial'}]);
  if(tab==='history'){
    var hh='';(d.history||[]).forEach(function(x){hh+='<div class="env-row"><span class="vl" style="color:var(--text)">'+esc(x)+'</span></div>';});
    body.innerHTML=hh||'<div class="env-empty">History is empty</div>';return;
  }
  var env=d.env||[];
  if(!env.length){body.innerHTML='<div class="env-head"><span style="flex:1;text-align:center">Environment is empty</span></div>';return;}
  var secs=[['data','Data'],['values','Values'],['functions','Functions']],h='';
  secs.forEach(function(s){
    var rows=env.filter(function(e){return e.kind===s[0];});if(!rows.length)return;
    h+='<div class="env-sec">'+s[1]+'</div>';
    rows.forEach(function(r){h+='<div class="env-row"><span class="nm">'+esc(r.name)+'</span><span class="vl">'+esc(r.value)+'</span></div>';});
  });
  body.innerHTML=h;
}

function renderFiles(d){
  var tab=d.rightTab||'files';
  setTabs($('files-tabs'),tab,[{id:'files',label:'Files'},{id:'plots',label:'Plots'},{id:'packages',label:'Packages'},{label:'Help'},{label:'Viewer'},{label:'Presentation'}]);
  var tb=$('files-toolbar'),body=$('files-body');
  if(tab==='plots'){
    var n=d.plotCount||0,i=d.plotIndex||0;
    tb.innerHTML='<span class="ico">&#9664;</span><span class="ico">&#9654;</span><span class="btn">&#128269; Zoom</span><span class="btn">Export <small>&#9662;</small></span><span class="ico" style="color:#c0392b">&#10005;</span><span class="ico">&#129529;</span><span class="spacer"></span><span class="rver">'+(n?(i+1)+' of '+n:'')+'</span><span class="ico">&#8635;</span>';
    body.innerHTML=d.plot?'<div class="plotarea"><img id="plot" alt="R plot" src="'+d.plot+'"></div>':'<div class="plot-empty">No plots yet</div>';
  }else if(tab==='packages'){
    tb.innerHTML='<span class="btn">&#8681; Install</span><span class="btn">&#8635; Update</span><span class="spacer"></span><span class="search">&#128269;</span>';
    var h='<div class="pkg" style="background:var(--head);font-weight:600"><span class="cb"></span><span class="nm" style="color:var(--muted)">Name</span><span class="ds">Description</span><span class="vr">Version</span></div><div class="env-sec">User Library</div>';
    (d.packages||[]).forEach(function(p){h+='<div class="pkg"><span class="cb">'+(p.loaded?'&#10003;':'')+'</span><span class="nm">'+esc(p.name)+'</span><span class="ds">'+esc(p.title||'')+'</span><span class="vr">'+esc(p.version)+'</span></div>';});
    body.innerHTML=h;
  }else{
    tb.innerHTML='<span class="btn">&#10133; New Blank File <small>&#9662;</small></span><span class="btn">&#128193; New Folder</span><span class="btn">&#10006; Delete</span><span class="btn">&#9998; Rename</span><span class="btn">&#9881; More <small>&#9662;</small></span>';
    var f='<div class="frow" style="background:var(--head)"><span class="nm" style="color:var(--muted)">&#8624; '+esc(d.workdir||'~')+'</span></div><div class="frow hd"><span class="nm">&#9660; Name</span><span class="sz">Size</span></div><div class="frow"><span class="nm">&#8593; ..</span><span class="sz"></span></div>';
    (d.files||[]).forEach(function(x){f+='<div class="frow"><span class="nm">'+(/\.R$/i.test(x.name)?'&#128215; ':/\.png$/i.test(x.name)?'&#128247; ':'&#128196; ')+esc(x.name)+'</span><span class="sz">'+sizeText(x.size)+'</span></div>';});
    body.innerHTML=f;
  }
}

window.RStudioIDE={
  load:function(d){
    document.body.className='theme-'+(d.theme==='dark'?'dark':'light');
    $('window-title').textContent='RStudio';
    $('r-ver').textContent=d.rShort||'R';
    $('wd').textContent=d.workdir||'~/';
    renderSource(d);renderConsole(d);renderEnv(d);renderFiles(d);
    window.__rstudioReady=true;return true;
  },
  highlight:highlight
};
window.__rstudioApi=true;
})();
