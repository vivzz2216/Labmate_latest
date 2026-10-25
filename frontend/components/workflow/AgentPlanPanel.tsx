'use client';
import {useState} from 'react';
import type {LabWorkflow} from '@/lib/workflow';
import styles from './AgentPlanPanel.module.css';

export default function AgentPlanPanel({workflow,busy,onAnswer}:{workflow:LabWorkflow;busy:boolean;onAnswer:(answers:Record<string,string>)=>Promise<void>}) {
  const plan=workflow.agent_plan;
  const [answers,setAnswers]=useState<Record<string,string>>(()=>plan?.answers||{});
  const waiting=workflow.status==='awaiting_clarification';
  const questions=plan?.questions||[];
  const tasks=(plan?.tasks||[]).filter(t=>t.topic||t.source_policy==='complete');
  if(!waiting&&!tasks.length)return null;
  return <section className={styles.panel} aria-label="Assignment plan">
    <h2>{waiting?'A few decisions before I continue':'Project plan'}</h2>
    {waiting?<form onSubmit={event=>{event.preventDefault();void onAnswer(answers);}}>
      <p>Your answers are saved with this assignment. Execution starts after these decisions are resolved.</p>
      {questions.map(question=><label className={styles.question} key={question.id}>
        <span>{question.prompt}</span>
        {question.options.length&&!question.id.startsWith('topic-')?<select required value={answers[question.id]||''} onChange={e=>setAnswers({...answers,[question.id]:e.target.value})}>
          <option value="">Choose an answer</option>{question.options.map(option=><option key={option}>{option}</option>)}
        </select>:<><input required maxLength={1000} list={`choices-${question.id}`} value={answers[question.id]||''} onChange={e=>setAnswers({...answers,[question.id]:e.target.value})}/>
          <datalist id={`choices-${question.id}`}>{question.options.map(option=><option key={option} value={option}/>)}</datalist></>}
        <details><summary>Why this is needed</summary><p>{question.source_excerpt}</p></details>
      </label>)}
      <button disabled={busy||questions.some(q=>!answers[q.id]?.trim())}>{busy?'Saving answers…':'Save answers and continue'}</button>
    </form>:tasks.map(task=><div className={styles.task} key={task.id}>
      {task.topic&&<h3>{task.topic}</h3>}<p>{task.reason}</p>
      {!!task.features.length&&<ul>{task.features.map(feature=><li key={feature}>{feature}</li>)}</ul>}
      {task.source_policy==='complete'&&<p className={styles.note}>Every authored source file and line will be captured in readable image pages, followed by tested output screenshots.</p>}
    </div>)}
  </section>;
}
