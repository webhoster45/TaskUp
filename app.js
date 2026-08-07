require('dotenv').config()
const express=require('express');
const app=express();
const fs=require('fs');
const jwt=require('jsonwebtoken')
const fspromises=require('fs').promises;
const path=require('path');
const bcrypt=require("bcrypt");
const { title } = require('process');
const PORT=3000;
const JWT_SECRET=process.env.JWT_SECRET;
const {v4:uuidv4}=require('uuid');


app.use(express.json());
app.use(express.urlencoded({extended:true}));
app.use(express.static('./public'));

const authmiddleware=async (req,res,next)=>{
    const authheader=req.headers.authorization;
    if(!authheader)return res.status(401).json({message:"Unauthorized"});
    const token=authheader.split(" ")[1];
    jwt.verify(token,JWT_SECRET,(err,decoded)=>{
    if(err) return res.status(401).json({message:"unauthorized"})
    req.user=decoded;
    next()
})}



async function reader(filename) {
    try {
        const mrfile = path.join(__dirname, 'data', filename);
        if (fs.existsSync(mrfile)) {
            const data = await fspromises.readFile(mrfile, 'utf8');
            if (mrfile.endsWith('.json')) {
                return JSON.parse(data);
            } else {
                return data;
            }
        } else {
            // FIX: Write an empty array string '[]' instead of a live array object []
            await fspromises.writeFile(mrfile, '[]');
            return []; // FIX: Return the empty array so the writer can use it immediately
        }
    } catch (error) {
        console.log(error);
    }
}

async function writer(content, filename) {
    try {
        let filefamily = await reader(filename);
        const mrfile = path.join(__dirname, 'data', filename);
        
        // FIX: Ensure filefamily is treated as an array if the file was empty/just created
        if (!Array.isArray(filefamily)) {
            filefamily = [];
        }
        
        filefamily.push(content); // Modifies the array in place

        // FIX: Convert the array to a string using JSON.stringify before writing
        await fspromises.writeFile(mrfile, JSON.stringify(filefamily, null, 2), 'utf8');
        console.log("Data successfully written!");
        } catch (error) {
        console.log(error);
        }
}

app.get('/',(req,res)=>{
        res.sendFile(path.join(__dirname,'views','index.html'))
});

app.get('/signup',(req,res)=>{
        res.sendFile(path.join(__dirname,'views','signup.html'))
});  

app.get('/dashboard',authmiddleware,(req,res)=>{
        res.sendFile(path.join(__dirname,'views','dashboard.html'))
})

app.post('/signup',async (req,res)=>{
try {
        const {username, password,email}=req.body;
        if(!username,!password,!email) return res.status(400).json({message:"Missing parameters"});
    
        const User=await reader('users.json');
        const existinguser=User.find(u=>{
        if (u.username == username){return true
            }
        });


const hashedpassword=await bcrypt.hash(password,10)


    if(existinguser) return res.status(409).json({message:"User already exists"});


    let payload={
        username,
        password:hashedpassword,
        email,
        createdat:new Date()
    }

    writer(payload,'users.json');

    const token=jwt.sign({username},JWT_SECRET);
    console.log(token)
    return res.status(200).json({message:`User ${username} created successfully`,token});

    
} catch (error) {
    return res.status(500).json({message:'Internal Error'})
}
    
});


app.get('/signin',(req,res)=>{
        res.sendFile(path.join(__dirname,'views','signin.html'))
})


app.post('/signin',async (req,res)=>{
    try {
        const {username, password}=req.body;
        if(!username,!password) return res.status(400).json({message:"Missing parameters"});
    
        const User=await reader('users.json');
        const existinguser=User.find(u=>{
        if (u.username == username){return true
            }
           });
        if(!existinguser) return res.status(400).json({message:"User doesn't exist"})


        const match=await bcrypt.compare(password,existinguser.password)
        if(!match) return res.status(400).json({message:"Invalid credentials"})


        const token=jwt.sign({username},JWT_SECRET);
        console.log(token)
        return res.status(200).json({message:`User: ${username} Logged In Successfully`,token});

        
        } catch (error) {
            return res.status(500).json({message:'Internal Error'})
        }
})


app.post('/addtask',authmiddleware,async (req,res)=>{
        const {username}=req.user;
        const {title,description}=req.body;
        const taskbox=await reader('task.json');
        const payload={
            username,
            title,
            description,
            id:uuidv4(),
            completed:false,
            createdat:new Date()
        };
       writer(payload,'task.json');


});

app.get('/gettask',authmiddleware,async (req,res)=>{
    const {username}=req.user;
    const taskbox=await reader("task.json");
    const usertask=taskbox.filter(task=>username==task.username);
    if(usertask.length==0) return res.status(404).json({message:"No tasks found"});
    return res.status(200).json({message:"Fetched tasks successfully",tasks:usertask})
})

app.post('/edit/:id',authmiddleware,async(req,res)=>{
    const {id}=req.params;
    const {username}=req.user;
    const {title,description}=req.body;
    const taskbox=await reader("task.json");
    const confirmtask=taskbox.find(task=>task.id==id&&task.username==username);
    if(!confirmtask) return res.status(404).json({message:"Task not found"});
    confirmtask.title=title;
    confirmtask.description=description;
    writer(confirmtask,'task.json');
    return res.status(200).json({message:"Task Updated Successfully",task:confirmtask})

});

app.post('/deletetask/:id',authmiddleware,async (req,res)=>{
    const {id}=req.params;
    const {username}=req.user;
    const taskbox=await reader("task.json");
    const confirmtask=taskbox.find(task=>task.id==id&&task.username==username);
    if(!confirmtask) return res.status(404).json({message:"Task not found"});
    taskbox.splice(taskbox.indexOf(confirmtask),1);
    writer(taskbox,'task.json');
    return res.status(200).json({message:"Task Deleted Successfully",confirmtask})
    
});

app.post('/mark/:id',authmiddleware,async (req,res)=>{
    const {id}=req.params;
    const {username}=req.user;
    const taskbox=await reader("task.json");
    const confirmtask=taskbox.find(task=>task.id==id&&task.username==username);
    if(!confirmtask) return res.status(404).json({message:"Task not found"});
    confirmtask.completed=true;
    writer(confirmtask,'task.json');
    return res.status(200).json({message:"Task Marked",task:confirmtask});
});

app.post('/email/:id',authmiddleware,async (req,res)=>{
    const {id}=req.params;
    const {username}=req.user;
    const taskbox=await reader("task.json");
    const confirmtask=taskbox.find(task=>task.id==id&&task.username==username);
    if(!confirmtask) return res.status(404).json({message:"Task not found"});
    
});

app.post('/health',(req,res)=>{
        res.status(200).json({message:"Working"})
})

app.use((req,res)=>{
        return res.status(404).json({message:"Page doesn't exist"})
})

app.listen(PORT,()=>{
        console.log(`App listening on PORT: ${PORT}`)
});

