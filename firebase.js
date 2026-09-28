const db = firebase.firestore();

export async function insert(item){
    try {
        const response = await db.collection("todos").add(item)
    } catch (error) {
        console.error(error)
        throw new Error(error)
    }
}

export async function getItems(uid){
    try {
        let items = [];
        const response = await db
        .collection("todos")
        .where ("userid", "==", uid)
        .get();

        response.forEach((doc) =>{
            items.push(doc.data())
        });
        return items;
    } catch (error) {
        console.error("Error al obtener items:", error);
        throw new Error(error);
    }
}


export async function markItem(item, state, uid){
    let docId;
    try {
        const doc = await db.collection("todos").where("id", "==", item).where("userid", "==", uid).get();

        doc.forEach(i => {
            docId = i.id;
        })
    
        
    await db
        .collection("todos")
        .doc(docId)
        .update({ completed: state });
    } catch (error) {
        throw new Error(error)
        
    }
}

export async function updateText(item, text, uid){
    let docId;
    try {
        const doc = await db.collection("todos").where("id", "==", item).where("userid", "==", uid).get();

        doc.forEach(i => {
            docId = i.id;
        })
    
        
    await db
        .collection("todos")
        .doc(docId)
        .update({ text: text });
    } catch (error) {
        throw new Error(error)
        
    }
}

export async function deleteItems(item, uid) {
    let docId;
    try {
        const doc = await db.collection("todos").where("id", "==", item).where("userid", "==", uid).get();

        doc.forEach(i => {
            docId = i.id;
        })
    
        
    await db
        .collection("todos")
        .doc(docId)
        .delete();
    } catch (error) {
        throw new Error(error)
        
    }
}


// ---------- Cards ----------

async function getCardDocId(cardId, uid) {
    let docId;
    const snap = await db.collection("cards").where("id", "==", cardId).where("userid", "==", uid).get();
    snap.forEach(d => {
        docId = d.id
    })
    return docId;
}

export async function insertCard(card) {
    try {
        await db.collection("cards").add(card)
    } catch (error) {
        console.error(error)
        throw new Error(error)
    }
}

export async function getCards(uid) {
    try {
        const cards = [];
        const snap = await db.collection("cards").where("userid", "==", uid).get();
        snap.forEach((d) => {
            cards.push(d.data())
        });
        return cards;
    } catch (error) {
        console.error("Error al obtener cards:", error);
        throw new Error(error);
    }
}

export async function updateCard(cardId, data, uid) {
    try {
        const docId = await getCardDocId(cardId, uid);
        await db.collection("cards").doc(docId).update(data);
    } catch (error) {
        throw new Error(error)
    }
}

// Borra la card y todas sus tareas en una sola operación
export async function deleteCard(cardId, uid) {
    try {
        const docId = await getCardDocId(cardId, uid);
        const todos = await db.collection("todos").where("cardId", "==", cardId).where("userid", "==", uid).get();
        const batch = db.batch();
        todos.forEach((d) => batch.delete(d.ref));
        batch.delete(db.collection("cards").doc(docId));
        await batch.commit();
    } catch (error) {
        throw new Error(error)
    }
}

// Migración: tareas creadas antes de las cards pasan a la card indicada
export async function assignOrphanTasks(uid, cardId) {
    try {
        const snap = await db.collection("todos").where("userid", "==", uid).get();
        const batch = db.batch();
        let count = 0;
        snap.forEach((d) => {
            const data = d.data();
            if (data.cardId === undefined) {
                batch.update(d.ref, { cardId: cardId, dayOfWeek: data.dayOfWeek ?? new Date().getDay() });
                count++;
            }
        });
        if (count > 0) await batch.commit();
        return count;
    } catch (error) {
        throw new Error(error)
    }
}


// Actualiza campos de una o más tareas a la vez (mover de día / de card)
export async function updateItems(ids, data, uid) {
    try {
        const wanted = new Set(ids);
        const snap = await db.collection("todos").where("userid", "==", uid).get();
        const batch = db.batch();
        snap.forEach((d) => {
            if (wanted.has(d.data().id)) batch.update(d.ref, data);
        });
        await batch.commit();
    } catch (error) {
        throw new Error(error)
    }
}