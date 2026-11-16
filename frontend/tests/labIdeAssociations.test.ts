import test from "node:test";
import assert from "node:assert/strict";
import {LAB_IDE_ASSOCIATIONS,labIdeOptions,resolveLabIde,labIdeHref,workspaceLocation} from "../lib/mumbaiUniversity/labIdeAssociations.ts";

test('upload, template switch and reset preserve lab context and enforce its language', () => {
  for (const [labId,lab] of Object.entries(LAB_IDE_ASSOCIATIONS)) {
    const query = new URLSearchParams({muLab:labId,ide:lab.defaultIde,language:'auto',track:'existing'});
    const uploaded = workspaceLocation(query.toString(), 42);
    const params = new URL(uploaded,'http://localhost').searchParams;
    assert.equal(params.get('muLab'),labId);
    assert.equal(params.get('assignment'),'42');
    assert.equal(params.get('language'),lab.language);
    assert.equal(params.get('ide'),lab.defaultIde);
    assert.equal(params.get('track'),'existing');
    const reset = new URL(workspaceLocation(params.toString()),'http://localhost').searchParams;
    assert.equal(reset.get('assignment'),null);
    assert.equal(reset.get('muLab'),labId);
    for (const ide of labIdeOptions(labId)) {
      const switched = new URL(workspaceLocation(params.toString(),42,ide),'http://localhost').searchParams;
      assert.equal(switched.get('ide'),ide);
      assert.equal(switched.get('assignment'),'42');
    }
  }
  assert.equal(workspaceLocation('assignment=3'),'/code-execution');
});
test("each connected lab has one valid default and only its assigned alternatives",()=>{
  assert.equal(Object.keys(LAB_IDE_ASSOCIATIONS).length,7);
  for(const [id,lab] of Object.entries(LAB_IDE_ASSOCIATIONS)){
    assert.equal(resolveLabIde(id),lab.defaultIde);
    assert.equal(resolveLabIde(id,"unrelated"),lab.defaultIde);
    assert.equal(new Set(labIdeOptions(id)).size,labIdeOptions(id).length);
    for(const ide of labIdeOptions(id))assert.equal(resolveLabIde(id,ide),ide);
  }
  assert.deepEqual(labIdeOptions("mu-nep-sem1-vsec102-c-programming"),["codeblocks","vscode"]);
  assert.deepEqual(labIdeOptions("mu-nep-sem2-vsec202-python-programming"),["idle","vscode","jupyter"]);
  assert.deepEqual(labIdeOptions("mu-nep-sem3-full-stack-java"),["notepad","eclipse","intellij","vscode"]);
  assert.deepEqual(labIdeOptions("mu-nep-sem4-dbms-lab"),["workbench","sqlite","mysql-cli"]);
});
test("workspace alternatives use their existing routes; C stays C and SQL stays MySQL by default",()=>{
  const java="mu-nep-sem3-full-stack-java", sql="mu-nep-sem4-dbms-lab";
  assert.ok(labIdeHref(java,"eclipse")?.startsWith("/eclipse?"));
  assert.ok(labIdeHref(java,"intellij")?.startsWith("/intellij?"));
  assert.ok(labIdeHref(sql,"sqlite")?.startsWith("/db-browser?"));
  assert.ok(labIdeHref(sql,"mysql-cli")?.startsWith("/mysql-cli?"));
  assert.ok(labIdeHref(sql)?.startsWith("/code-execution?"));
  assert.ok(labIdeHref("mu-nep-sem1-vsec102-c-programming")?.includes("language=c"));
  assert.equal(labIdeHref("not-connected"),undefined);
  assert.deepEqual(labIdeOptions("not-connected"),[]);
});
