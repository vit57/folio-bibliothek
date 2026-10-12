let connection;
function openDatabase(){
  if(connection)return connection;
  connection=new Promise((resolve,reject)=>{
    const request=indexedDB.open('folio-books-v1',1);let blocked=false;
    request.onupgradeneeded=()=>{for(const name of ['books','files','folders','annotations','settings'])if(!request.result.objectStoreNames.contains(name))request.result.createObjectStore(name,{keyPath:'id'});};
    request.onsuccess=()=>{const database=request.result;if(blocked){database.close();return;}database.onversionchange=()=>{database.close();connection=null;};database.onclose=()=>{connection=null;};resolve(database);};
    request.onerror=()=>{connection=null;reject(request.error);};
    request.onblocked=()=>{blocked=true;connection=null;reject(new Error('Ein anderes folio-Fenster blockiert den Speicher. Bitte dieses Fenster schließen und erneut versuchen.'));};
  });return connection;
}
async function run(stores,mode,perform){
  const database=await openDatabase();
  return new Promise((resolve,reject)=>{
    let transaction,result;
    try{
      transaction=database.transaction(stores,mode);
      transaction.oncomplete=()=>resolve(result?.result);
      transaction.onerror=event=>reject(event.target?.error || transaction.error || new Error('Speichern fehlgeschlagen.'));
      transaction.onabort=()=>reject(transaction.error || new Error('Speichern abgebrochen.'));
      result=perform(transaction);
    }catch(error){transaction?.abort();reject(error);}
  });
}
export const db={
  all:name=>run(name,'readonly',t=>t.objectStore(name).getAll()),
  get:(name,id)=>run(name,'readonly',t=>t.objectStore(name).get(id)),
  put:(name,value)=>run(name,'readwrite',t=>t.objectStore(name).put(value)),
  del:(name,id)=>run(name,'readwrite',t=>t.objectStore(name).delete(id)),
  batch:changes=>changes.length?run([...new Set(changes.map(c=>c.store))],'readwrite',t=>{for(const c of changes)c.delete?t.objectStore(c.store).delete(c.id):t.objectStore(c.store).put(c.value);}):Promise.resolve()
};
