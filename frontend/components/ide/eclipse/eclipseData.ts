export interface WorkspaceJavaFile {
  id: string;
  projectId: string;
  packageName: string; // "" for (default package)
  fileName: string;
  code: string;
  savedCode: string;
}

export interface WorkspaceProject {
  id: string;
  name: string;
  hasMaven: boolean;
  hasWarning: boolean;
  jreLabel: string;
}

export interface ConsoleLaunchRecord {
  id: string;
  label: string;
  headerText: string;
  stdout: string;
  stderr: string;
  terminated: boolean;
}

export const INITIAL_OPENCLASSROOMS_CODE =
  "package com.openclassrooms;\n\n" +
  "public class HelloWorld {\n\n" +
  "\tpublic static void main(String[] args) {\n" +
  "\t\t// TODO Auto-generated method stub\n" +
  '\t\tSystem.out.println("I am using Eclipse!");\n' +
  "\t}\n\n" +
  "}\n";

export const INITIAL_DEFAULT_PKG_CODE =
  "public class HelloWorld {\n\n" +
  "\tpublic static void main(String[] args) {\n" +
  "\t\t// TODO Auto-generated method stub\n" +
  '\t\tSystem.out.println("Hello World!");\n' +
  "\t}\n\n" +
  "}\n";

export const INITIAL_ES_APP_CODE =
  "package es.app;\n\n" +
  "public class MainApp {\n\n" +
  "\tpublic static void main(String[] args) {\n" +
  "\t\tint sum = 0;\n" +
  "\t\tfor (int i = 1; i <= 5; i++) {\n" +
  "\t\t\tsum += i;\n" +
  "\t\t}\n" +
  '\t\tSystem.out.println("Sum 1..5 = " + sum);\n' +
  "\t}\n\n" +
  "}\n";

export const INITIAL_PROJECTS: WorkspaceProject[] = [
  {
    id: "proj-es",
    name: "es",
    hasMaven: true,
    hasWarning: true,
    jreLabel: "JRE System Library [JavaSE-1.8]",
  },
  {
    id: "proj-helloworld",
    name: "HelloWorld",
    hasMaven: false,
    hasWarning: false,
    jreLabel: "JRE System Library [JavaSE-1.8]",
  },
];

export const INITIAL_FILES: WorkspaceJavaFile[] = [
  {
    id: "file-es-main",
    projectId: "proj-es",
    packageName: "es.app",
    fileName: "MainApp.java",
    code: INITIAL_ES_APP_CODE,
    savedCode: INITIAL_ES_APP_CODE,
  },
  {
    id: "file-hw-default",
    projectId: "proj-helloworld",
    packageName: "",
    fileName: "HelloWorld.java",
    code: INITIAL_DEFAULT_PKG_CODE,
    savedCode: INITIAL_DEFAULT_PKG_CODE,
  },
  {
    id: "file-hw-openclassrooms",
    projectId: "proj-helloworld",
    packageName: "com.openclassrooms",
    fileName: "HelloWorld.java",
    code: INITIAL_OPENCLASSROOMS_CODE,
    savedCode: INITIAL_OPENCLASSROOMS_CODE,
  },
];

export const INITIAL_CONSOLE_LAUNCH: ConsoleLaunchRecord = {
  id: "launch-initial-2",
  label: "HelloWorld (2) [Java Application]",
  headerText:
    "<terminated> HelloWorld (2) [Java Application] C:\\Program Files\\Java\\jdk1.8.0_131\\bin\\javaw.exe (Nov 11, 2018, 8:30:52 PM)",
  stdout: "I am using Eclipse!\n",
  stderr: "",
  terminated: true,
};

export const JRE_JAR_ENTRIES = [
  "rt.jar - C:\\Program Files\\Java\\jdk1.8.0_131\\jre\\lib\\rt.jar",
  "jce.jar - C:\\Program Files\\Java\\jdk1.8.0_131\\jre\\lib\\jce.jar",
  "jsse.jar - C:\\Program Files\\Java\\jdk1.8.0_131\\jre\\lib\\jsse.jar",
  "charsets.jar - C:\\Program Files\\Java\\jdk1.8.0_131\\jre\\lib\\charsets.jar",
];

export function getWorkspaceFilePath(file: WorkspaceJavaFile, projectName: string): string {
  const pkgPath = file.packageName ? file.packageName.split(".").join("/") + "/" : "";
  return `${projectName}/src/${pkgPath}${file.fileName}`;
}

export function getResourceFolderPath(file: WorkspaceJavaFile, projectName: string): string {
  const pkgPath = file.packageName ? "/" + file.packageName.split(".").join("/") : "";
  return `/${projectName}/src${pkgPath}`;
}

export function formatEclipseTimestamp(date: Date): string {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const mon = months[date.getMonth()];
  const day = date.getDate();
  const year = date.getFullYear();
  let hours = date.getHours();
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  if (hours === 0) hours = 12;
  const mins = String(date.getMinutes()).padStart(2, "0");
  const secs = String(date.getSeconds()).padStart(2, "0");
  return `${mon} ${day}, ${year}, ${hours}:${mins}:${secs} ${ampm}`;
}
