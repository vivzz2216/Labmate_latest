import test from "node:test";
import assert from "node:assert/strict";
import {LAB_IDE_ASSOCIATIONS,labIdeOptions,resolveLabIde,labIdeHref} from "../lib/mumbaiUniversity/labIdeAssociations.ts";
test("each connected lab has one valid default and only its assigned alternatives",()=>{
  assert.equal(Object.keys(LAB_IDE_ASSOCIATIONS).length,6);
  for(const [id,lab] of Object.entries(LAB_IDE_ASSOCIATIONS)){
    assert.equal(resolveLabIde(id),lab.defaultIde);
    assert.equal(resolveLabIde(id,"unrelated"),lab.defaultIde);
    assert.equal(new Set(labIdeOptions(id)).size,labIdeOptions(id).length);
    for(const ide of labIdeOptions(id))assert.equal(resolveLabIde(id,ide),ide);
  }
  assert.deepEqual(labIdeOptions("mu-nep-sem1-vsec102-c-programming"),["codeblocks","vscode"]);
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
