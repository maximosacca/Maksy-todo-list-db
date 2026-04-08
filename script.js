import { login, logout } from "./auth.js"
import { getUUID } from "./utils.js"
import { insert, getItems, deleteItems, markItem, updateText } from "./firebase.js"


const userInfo = document.querySelector("#user-info")

const appMain = document.querySelector("#app-main")

const activityInput = document.querySelector("#activity-input")

const activityButton = document.querySelector(".activity-button")

const activityList = document.querySelector(".activity-list")

const activityDialog = document.querySelector(".activityDialog")

const editableInput = document.querySelector("#editable-activity-input")

const editableButton = document.querySelector(".editable-activity-button")

const buttonLogin = document.querySelector("#button-login");

const buttonLogout = document.querySelector("#button-logout")

const closingModalSpam = document.querySelector("#close-dialog")

let currentUser;
let tasks = [];
let editableTasks = null

firebase.auth().onAuthStateChanged(user => {
    if (user) {
        currentUser = user
        console.log("Usuario logeado", currentUser.displayName);
        init();
    } else {
        console.log("No hay usuario logeado")
        hideUI();
    }
})


function init() {
    buttonLogin.classList.add("hidden");
    buttonLogout.classList.remove("hidden");
    appMain.classList.remove("hidden");
    userInfo.classList.remove("hidden");

    userInfo.innerHTML = `
  <img src="${currentUser.photoURL}" width="32" />
  <span>${currentUser.displayName}</span>
  `;


    loadTask();
}

buttonLogin.addEventListener("click", async (e) => {
    try {
        currentUser = await login();
    } catch (error) {
        console.error(error)
    }
});

buttonLogout.addEventListener("click", (e) => {
    logout();
    hideUI()
});



function hideUI() {
    buttonLogin.classList.remove("hidden");
    buttonLogout.classList.add("hidden")
    appMain.classList.add("hidden")
    userInfo.classList.add("hidden")
    activityList.innerHTML = ""
}

activityInput.addEventListener("keydown", async (e) => {
    const text = activityInput.value;
    if (e.key === "Enter") {
        if (text !== "") {
            await addTask(text); // CORRECCIÓN: Agregar await
            activityInput.value = "";
        }
    }
});

activityButton.addEventListener("click", async (e) => {
    e.preventDefault();
    const text = activityInput.value;

    if (text.trim() !== "") {
        await addTask(text.trim());
        activityInput.value = "";
    } else {
        if (document.body.querySelector("#wrong") === null) {
            let wrong = document.createElement("p")
            wrong.textContent = "Ingresa un valor valido"
            wrong.id = "wrong"
            document.querySelector(".card-header").appendChild(wrong)
            setTimeout(() => {
                wrong.remove()
            }, 1500)
        }
    }
});

async function loadTask() {
    tasks = [];
    try {
        const response = await getItems(currentUser.uid);
        tasks = [...response];
        renderTasks();
    } catch (error) {
        console.error("Error cargando todos:", error);
    }
}

function renderTasks() {
    let html = "";
    tasks.forEach((task) => {
        html += `
    <li class="${task.completed}" data-id="${task.id}">
        <span data-id="${task.id}">${task.text}</span>
        <span class="delete-icon" data-id="${task.id}"></span>
        <span class="edit-icon" data-id="${task.id}"></span>
    </li> 
    `;
    });
    activityList.innerHTML = html;
}

editableInput.addEventListener("keydown", async (e) => {
    let task = editableTasks
    if (e.key === "Enter") {
        if (editableInput.value.trim() != "") {
            if (editableInput.value.trim() != task.text) {
                let item = task.id
                let text = editableInput.value
                await updateText(item, text, currentUser.uid)
                loadTask()
                activityDialog.close()
            } else {
                if (document.body.querySelector("#wrong-dialog") === null) {
                    let wrongDialog = document.createElement("p")
                    wrongDialog.textContent = "El texto ingresado es igual a la tarea anterior"
                    wrongDialog.id = "wrong-dialog"
                    document.querySelector(".dialog-h2").appendChild(wrongDialog)
                    setTimeout(() => {
                        wrongDialog.remove()
                    }, 1500)
                }
            }
        } else {
            if (document.body.querySelector("#wrong-dialog") === null) {
                let wrongDialog = document.createElement("p")
                wrongDialog.textContent = "Ingresa un texto valido"
                wrongDialog.id = "wrong-dialog"
                document.querySelector(".dialog-h2").appendChild(wrongDialog)
                setTimeout(() => {
                    wrongDialog.remove()
                }, 1500)
            }
        }
    }
})

editableButton.addEventListener("click", async (e) => {
    let task = editableTasks
    if (editableInput.value.trim() != "") {
        if (editableInput.value.trim() != task.text) {
            let item = task.id
            let text = editableInput.value
            await updateText(item, text, currentUser.uid)
            loadTask()
            activityDialog.close()
        } else {
            if (document.body.querySelector("#wrong-dialog") === null) {
                let wrongDialog = document.createElement("p")
                wrongDialog.textContent = "El texto ingresado es igual a la tarea anterior"
                wrongDialog.id = "wrong-dialog"
                document.querySelector(".dialog-h2").appendChild(wrongDialog)
                setTimeout(() => {
                    wrongDialog.remove()
                }, 1500)
            }
        }
    } else {
        if (document.body.querySelector("#wrong-dialog") === null) {
            let wrongDialog = document.createElement("p")
            wrongDialog.textContent = "Ingresa un texto valido"
            wrongDialog.id = "wrong-dialog"
            document.querySelector(".dialog-h2").appendChild(wrongDialog)
            setTimeout(() => {
                wrongDialog.remove()
            }, 1500)
        }
    }
})

activityList.addEventListener("click", async (e) => {
    let elementList = e.target.closest("li")
    if (!elementList) return;
    let task = tasks.find(t => elementList.dataset.id == t.id)
    if (e.target.classList.contains("delete-icon")) {
        try {
            let item = task.id
            e.target.parentElement.remove()
            await deleteItems(item, currentUser.uid)
            loadTask()
        } catch (error) {
            console.error(error)
            loadTask()
        }
    } else if (e.target.classList.contains("edit-icon")) {
        console.log("modal")
        activityDialog.showModal()
        editableInput.value = task.text
        editableTasks = task
    } else {
        try {
            e.target.closest("li").classList.toggle("true")
            e.target.closest("li").classList.toggle("false")
            let item = task.id
            task.completed = !task.completed
            await markItem(item, task.completed, currentUser.uid)
        } catch (error) {
            console.error(error)
        }
    }
});

closingModalSpam.addEventListener("click", function () {
    activityDialog.close()
})

async function addTask(text) {

    const todo = {
        id: getUUID(),
        text: text,
        completed: false,
        userid: currentUser.uid

    }
    tasks.push(todo)
    renderTasks()
    try {
        const response = await insert(todo);
    } catch (error) {
        console.error(error)
        loadTask()
    }
}



