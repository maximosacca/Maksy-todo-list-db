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
