//task function normal js then task function with nodejs stimulation;


const tasks=[];

function addtask(task){
const existing=tasks.find(t=>{
if (t.Title==task.Title){return true
    }
})
if(!existing) tasks.push(task);
else { console.log(`${task.Title} already exists`)}

}

function edittask(index,newtask){
   if(index<0||index>tasks.length){
    console.log("Index too high");
   }
   else{
    tasks[index].Title=newtask.Title;
    tasks[index].Completed=newtask.Completed;
   }
}

function deletetask(index){
tasks.splice(index,1)
}




addtask({Title:"Do",Completed:"No"});
addtask({Title:"Yo",Completed:"Yes"});
addtask({Title:"Do",Completed:"No"});
addtask({Title:"Yo",Completed:"Yes"});
addtask({Title:"Yo",Completed:"Yes"});
addtask({Title:"Bo",Completed:"No"});
addtask({Title:"Yo",Completed:"Yes"});
addtask({Title:"Zo",Completed:"Yes"});
edittask(2,{Title:"Ya",Completed:"Yes"});


console.log(tasks)
deletetask(0);

console.log(tasks);



