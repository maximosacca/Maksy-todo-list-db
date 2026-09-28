import { login, logout } from "./auth.js"
import { getUUID } from "./utils.js"
import { insert, getItems, deleteItems, markItem, updateText, insertCard, getCards, updateCard, deleteCard, assignOrphanTasks, updateItems } from "./firebase.js"


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

const dayTabsContainer = document.querySelector("#day-tabs")

const dayTabButtons = document.querySelectorAll(".day-tab")

let currentUser;
let tasks = [];
let editableTasks = null
let selectedDay = new Date().getDay() // 0 = Domingo ... 6 = Sábado, arranca en el día de hoy
let cards = []
let selectedCardId = null
let editingCardId = null // null = creando una card nueva
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0] // Lun a Dom (getDay() devuelve 0 para domingo)

const cardChips = document.querySelector("#card-chips")
const buttonNewCard = document.querySelector("#button-new-card")
const buttonCardSettings = document.querySelector("#button-card-settings")
const cardDialog = document.querySelector("#card-dialog")
const cardDialogTitle = document.querySelector("#card-dialog-title")
const cardNameInput = document.querySelector("#card-name-input")
const cardDayChecks = document.querySelectorAll(".day-checks input")
const cardSaveButton = document.querySelector("#card-save-button")
const cardDeleteButton = document.querySelector("#card-delete-button")
const closeCardDialog = document.querySelector("#close-card-dialog")

const DAY_SHORT = { 1: "Lun", 2: "Mar", 3: "Mié", 4: "Jue", 5: "Vie", 6: "Sáb", 0: "Dom" }
const DAY_LONG = { 1: "Lunes", 2: "Martes", 3: "Miércoles", 4: "Jueves", 5: "Viernes", 6: "Sábado", 0: "Domingo" }
let movingTaskId = null

const moveDialog = document.querySelector("#move-dialog")
const moveCardField = document.querySelector("#move-card-field")
const moveDayField = document.querySelector("#move-day-field")
const moveCardSelect = document.querySelector("#move-card-select")
const moveDaySelect = document.querySelector("#move-day-select")
const moveSaveButton = document.querySelector("#move-save-button")
const closeMoveDialog = document.querySelector("#close-move-dialog")
const nextDayButton = document.querySelector("#button-next-day")

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


async function init() {
    buttonLogin.classList.add("hidden");
    buttonLogout.classList.remove("hidden");
    appMain.classList.remove("hidden");
    userInfo.classList.remove("hidden");

    userInfo.innerHTML = `
  <img src="${currentUser.photoURL}" width="32" />
  <span>${currentUser.displayName}</span>
  `;

    await loadCards();
    loadTask();
}

function getSelectedCard() {
    return cards.find((c) => c.id === selectedCardId)
}

// Card sin días activos = lista simple, sin separar por día
function hasNoDays() {
    const card = getSelectedCard()
    return !!card && card.activeDays.length === 0
}

// Si el día seleccionado está desactivado en la card, salta al próximo día activo
function ensureValidDay() {
    const card = getSelectedCard()
    if (!card || card.activeDays.length === 0 || card.activeDays.includes(selectedDay)) return;
    const start = WEEK_ORDER.indexOf(selectedDay)
    for (let i = 1; i <= 7; i++) {
        const day = WEEK_ORDER[(start + i) % 7]
        if (card.activeDays.includes(day)) {
            selectedDay = day
            return;
        }
    }
}

function renderDayTabs() {
    const card = getSelectedCard()
    dayTabsContainer.classList.toggle("hidden", hasNoDays())
    dayTabButtons.forEach((btn) => {
        const day = Number(btn.dataset.day)
        btn.classList.toggle("hidden", card ? !card.activeDays.includes(day) : false)
        btn.classList.toggle("active", day === selectedDay)
    })
}

function renderCards() {
    cardChips.innerHTML = ""
    cards.forEach((card) => {
        const chip = document.createElement("button")
        chip.type = "button"
        chip.className = "card-chip" + (card.id === selectedCardId ? " active" : "")
        chip.dataset.id = card.id
        chip.textContent = card.name
        cardChips.appendChild(chip)
    })
}

function refreshCardsUI() {
    ensureValidDay()
    renderCards()
    renderDayTabs()
    renderTasks()
}

async function loadCards() {
    try {
        cards = await getCards(currentUser.uid)
        if (cards.length === 0) {
            const general = { id: getUUID(), name: "General", userid: currentUser.uid, activeDays: [...WEEK_ORDER], createdAt: Date.now() }
            await insertCard(general)
            cards = [general]
        }
        cards.sort((a, b) => a.createdAt - b.createdAt)
        if (!cards.some((c) => c.id === selectedCardId)) selectedCardId = cards[0].id
        ensureValidDay()
        renderCards()
        renderDayTabs()
    } catch (error) {
        console.error("Error cargando cards:", error)
    }
}

dayTabsContainer.addEventListener("click", (e) => {
    const btn = e.target.closest(".day-tab")
    if (!btn) return;
    selectedDay = Number(btn.dataset.day)
    renderDayTabs()
    renderTasks()
});

cardChips.addEventListener("click", (e) => {
    const chip = e.target.closest(".card-chip")
    if (!chip) return;
    selectedCardId = chip.dataset.id
    refreshCardsUI()
});

buttonNewCard.addEventListener("click", () => {
    editingCardId = null
    cardDialogTitle.textContent = "Nueva card"
    cardNameInput.value = ""
    cardDayChecks.forEach((c) => c.checked = true)
    cardDeleteButton.classList.add("hidden")
    cardDialog.showModal()
});

buttonCardSettings.addEventListener("click", () => {
    const card = getSelectedCard()
    if (!card) return;
    editingCardId = card.id
    cardDialogTitle.textContent = "Configurar card"
    cardNameInput.value = card.name
    cardDayChecks.forEach((c) => c.checked = card.activeDays.includes(Number(c.value)))
    cardDeleteButton.classList.toggle("hidden", cards.length <= 1)
    cardDialog.showModal()
});

closeCardDialog.addEventListener("click", () => cardDialog.close());

// ---------- Mover tareas ----------

function fillMoveDays(cardId, preferredDay) {
    const card = cards.find((c) => c.id === cardId)
    const noDays = card.activeDays.length === 0
    moveDayField.classList.toggle("hidden", noDays)
    moveDaySelect.innerHTML = ""
    const days = WEEK_ORDER.filter((d) => card.activeDays.includes(d))
    days.forEach((d) => {
        const opt = document.createElement("option")
        opt.value = d
        opt.textContent = DAY_LONG[d]
        moveDaySelect.appendChild(opt)
    })
    if (!noDays) moveDaySelect.value = days.includes(preferredDay) ? preferredDay : days[0]
}

function openMoveDialog(task) {
    movingTaskId = task.id
    moveCardSelect.innerHTML = ""
    cards.forEach((card) => {
        const opt = document.createElement("option")
        opt.value = card.id
        opt.textContent = card.name
        moveCardSelect.appendChild(opt)
    })
    moveCardSelect.value = task.cardId
    moveCardField.classList.toggle("hidden", cards.length <= 1)
    fillMoveDays(task.cardId, task.dayOfWeek ?? new Date().getDay())
    moveDialog.showModal()
}

moveCardSelect.addEventListener("change", () => fillMoveDays(moveCardSelect.value, selectedDay));

closeMoveDialog.addEventListener("click", () => moveDialog.close());

moveSaveButton.addEventListener("click", async () => {
    const task = tasks.find((t) => t.id === movingTaskId)
    const targetCard = cards.find((c) => c.id === moveCardSelect.value)
    moveDialog.close()
    if (!task || !targetCard) return;
    const newDay = targetCard.activeDays.length === 0 ? null : Number(moveDaySelect.value)
    if (task.cardId === targetCard.id && task.dayOfWeek === newDay) return;
    task.cardId = targetCard.id
    task.dayOfWeek = newDay
    renderTasks()
    try {
        await updateItems([task.id], { cardId: task.cardId, dayOfWeek: task.dayOfWeek }, currentUser.uid)
    } catch (error) {
        console.error(error)
        loadTask()
    }
});

// ---------- Pasar todas al próximo día ----------

function getNextDay(card, day) {
    if (!card || card.activeDays.length === 0) return null
    const start = WEEK_ORDER.indexOf(day)
    for (let i = 1; i < 7; i++) {
        const d = WEEK_ORDER[(start + i) % 7]
        if (card.activeDays.includes(d)) return d
    }
    return null
}

function getDayTasks() {
    return tasks.filter((t) => t.cardId === selectedCardId && (t.dayOfWeek ?? new Date().getDay()) === selectedDay)
}

function updateNextDayButton() {
    const next = getNextDay(getSelectedCard(), selectedDay)
    const show = next !== null && getDayTasks().length > 0
    nextDayButton.classList.toggle("hidden", !show)
    if (show) nextDayButton.textContent = `Pasar todas al próximo día (${DAY_SHORT[next]})`
}

nextDayButton.addEventListener("click", async () => {
    const next = getNextDay(getSelectedCard(), selectedDay)
    const moving = getDayTasks()
    if (next === null || moving.length === 0) return;
    moving.forEach((t) => t.dayOfWeek = next)
    renderTasks()
    try {
        await updateItems(moving.map((t) => t.id), { dayOfWeek: next }, currentUser.uid)
    } catch (error) {
        console.error(error)
        loadTask()
    }
});

function showCardError(message) {
    if (document.querySelector("#card-error")) return;
    const p = document.createElement("p")
    p.id = "card-error"
    p.textContent = message
    cardDialogTitle.appendChild(p)
    setTimeout(() => p.remove(), 1500)
}

cardSaveButton.addEventListener("click", async () => {
    const name = cardNameInput.value.trim()
    const activeDays = [...cardDayChecks].filter((c) => c.checked).map((c) => Number(c.value))
    if (name === "") return showCardError("Ingresa un nombre valido")
    try {
        if (editingCardId) {
            await updateCard(editingCardId, { name, activeDays }, currentUser.uid)
            const card = cards.find((c) => c.id === editingCardId)
            card.name = name
            card.activeDays = activeDays
        } else {
            const card = { id: getUUID(), name, userid: currentUser.uid, activeDays, createdAt: Date.now() }
            await insertCard(card)
            cards.push(card)
            selectedCardId = card.id
        }
        refreshCardsUI()
        cardDialog.close()
    } catch (error) {
        console.error(error)
        showCardError("No se pudo guardar")
    }
});

cardDeleteButton.addEventListener("click", async () => {
    const card = cards.find((c) => c.id === editingCardId)
    if (!card) return;
    if (!confirm(`¿Borrar "${card.name}" y todas sus tareas?`)) return;
    try {
        await deleteCard(card.id, currentUser.uid)
        cards = cards.filter((c) => c.id !== card.id)
        tasks = tasks.filter((t) => t.cardId !== card.id)
        selectedCardId = cards[0].id
        refreshCardsUI()
        cardDialog.close()
    } catch (error) {
        console.error(error)
        showCardError("No se pudo borrar")
    }
});

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
        let items = await getItems(currentUser.uid);
        // Tareas de antes de las cards: se asignan a la primera card
        if (cards.length > 0 && items.some((t) => t.cardId === undefined)) {
            await assignOrphanTasks(currentUser.uid, cards[0].id)
            items = await getItems(currentUser.uid)
        }
        tasks = [...items];
        renderTasks();
    } catch (error) {
        console.error("Error cargando todos:", error);
    }
}

function renderTasks() {
    let html = "";
    tasks
        // Las tareas viejas que no tengan día asignado se muestran en "hoy" en vez de desaparecer
        .filter((task) => task.cardId === selectedCardId && (hasNoDays() || (task.dayOfWeek ?? new Date().getDay()) === selectedDay))
        .forEach((task) => {
            html += `
    <li class="${task.completed}" data-id="${task.id}">
        <span data-id="${task.id}">${task.text}</span>
        <span class="delete-icon" data-id="${task.id}"></span>
        <span class="edit-icon" data-id="${task.id}"></span>
        <span class="move-icon" data-id="${task.id}" title="Mover a"></span>
    </li> 
    `;
        });
    activityList.innerHTML = html;
    updateNextDayButton()
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
    } else if (e.target.classList.contains("move-icon")) {
        openMoveDialog(task)
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
    if (!selectedCardId) return;

    const todo = {
        id: getUUID(),
        text: text,
        completed: false,
        userid: currentUser.uid,
        cardId: selectedCardId,
        dayOfWeek: hasNoDays() ? null : selectedDay

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