// Este script deve ser incluído no index.html após a coleta especial
// Ele lê o arquivo indices_snapshot.json e salva no localStorage para congelamento por 15min
fetch('/indices_snapshot.json?t=' + Date.now())
  .then(r => r.json())
  .then(snapshot => {
    localStorage.setItem('static_indices_snapshot', JSON.stringify(snapshot));
    localStorage.setItem('static_indices_timestamp', Date.now().toString());
    console.log('Snapshot estático salvo no localStorage!');
  });