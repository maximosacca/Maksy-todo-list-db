// Integración con Habitica: un único hábito positivo ("Tarea completada")
// que se puntúa hacia arriba cada vez que completás una tarea.
// Las credenciales se guardan solo en este navegador (localStorage).

const API = "https://habitica.com/api/v3"
const APP_NAME = "TodoPersonal"
const HABIT_TEXT = "Tarea completada"
const STORAGE_KEY = "habitica-credentials"

function load() {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY))
    } catch {
        return null
    }
}

function save(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

export function isConnected() {
    const creds = load()
    return !!(creds && creds.userId && creds.token && creds.habitId)
}

export function getUserId() {
    return load()?.userId ?? ""
}

export function disconnect() {
    localStorage.removeItem(STORAGE_KEY)
}

async function request(method, path, creds, body) {
    const headers = {
        "x-api-user": creds.userId,
        "x-api-key": creds.token,
        "x-client": `${creds.userId}-${APP_NAME}`
    }
    if (body) headers["Content-Type"] = "application/json"
    const response = await fetch(`${API}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined
    })
    const json = await response.json().catch(() => ({}))
    if (!response.ok || json.success === false) {
        throw new Error(json.message || `Habitica respondió ${response.status}`)
    }
    return json.data
}

export async function fetchStats() {
    const creds = load()
    const user = await request("GET", "/user?userFields=stats", creds)
    const s = user.stats
    return { hp: s.hp, maxHealth: s.maxHealth, exp: s.exp, toNextLevel: s.toNextLevel, gp: s.gp, lvl: s.lvl }
}

// Valida las credenciales, busca (o crea) el hábito y las guarda. Devuelve los stats.
export async function connect(userId, token) {
    const creds = { userId: userId.trim(), token: token.trim() }
    await request("GET", "/user?userFields=stats", creds)
    const habits = await request("GET", "/tasks/user?type=habits", creds)
    let habit = habits.find((h) => h.text === HABIT_TEXT)
    if (!habit) {
        habit = await request("POST", "/tasks/user", creds, { text: HABIT_TEXT, type: "habit", up: true, down: false })
    }
    save({ ...creds, habitId: habit.id ?? habit._id })
    return fetchStats()
}

// Suma XP y oro. Devuelve los stats nuevos (hp, exp, gp, lvl).
export async function scoreUp() {
    const creds = load()
    return request("POST", `/tasks/${creds.habitId}/score/up`, creds)
}