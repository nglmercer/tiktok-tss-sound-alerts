// Función para obtener audio de la API
var voiceSelect = document.createElement('select');
Object.keys(VOICE_LIST).forEach(function(key) {
    var option = document.createElement('option');
    option.text = key;
    option.value = VOICE_LIST[key];
    voiceSelect.appendChild(option);
});
console.log('Voz seleccionada:', voiceSelect.value);
voiceSelect.addEventListener('change', function() {
    fetchAudio(voiceSelect.value);
});

let newChannel = '';
async function changeChannel() {
    newChannel = channelInput.value;
    window.location.hash = '#' + newChannel;
    return Promise.all(client.getChannels()
        .map(oldChannel => client.part(oldChannel))
    ).then(() =>
        client.join(newChannel)
    ).then(l =>
        console.log('unido al canal', l[0])
    );
}

// Función para manejar los mensajes entrantes
let lastUsername = '';
async function fetchAudio(txt, customVoice) {
    const resp = await fetch(TTS_API_ENDPOINT + makeParameters({ voice: voiceSelect.value, text: txt }));
    if (resp.status != 200) return console.error("bad Message");
    const blob = URL.createObjectURL(await resp.blob());
    audioqueue.enqueue(blob);
    if (!isPlaying) kickstartPlayer();
}
let profileImageUrl = ''; // URL de la imagen de perfil
let rankImageUrl = ''; // URL de la imagen de rango

async function onMessage(channel, tags, msg, self) {
    // Verifica si las imágenes están definidas y no están vacías
    if (profileImageUrl && profileImageUrl !== '' && rankImageUrl && rankImageUrl !== '') {
        const profileImage = document.createElement('img');
        profileImage.src = profileImageUrl;
        profileImage.classList.add('profile-image');

        const rankImage = document.createElement('img');
        rankImage.src = rankImageUrl;
        rankImage.classList.add('rank-image');

        // Crea el contenedor del mensaje y agrega las imágenes
        const txtbox = document.createElement('div');
        txtbox.appendChild(profileImage);
        txtbox.appendChild(rankImage);
    }

    if (self) return; // nunca es verdadero, pero mejor prevenir que curar

    let voice;
    let start_of_msg = msg.indexOf(' ');
    if (start_of_msg >= 0) {
        let tmpVoice = msg.slice(1, start_of_msg);
        if (msg[0] == VOICE_PREFIX && VOICE_LIST_ALT.indexOf(tmpVoice) >= 0) {
            voice = tmpVoice;
            console.log('cambiado la voz a:', tmpVoice);
            msg = msg.slice(start_of_msg);
        }
    }

    if (CHANNEL_BLACKLIST.some(ch => tags.username == ch))
        return console.log('ignorado el mensaje de,', tags.username);
    const usernameElement = document.createElement('span');
    usernameElement.classList.add('username');
    usernameElement.innerText = tags.username;

    const messageElement = document.createElement('span');
    messageElement.classList.add('message');
    messageElement.innerText = msg;

    const txtbox = document.createElement('div');
    txtbox.appendChild(usernameElement);
    txtbox.appendChild(document.createTextNode(': '));
    txtbox.appendChild(messageElement);

    console.log(tags.username, msg);
    insertText(txtbox);

    //*
    if (!voice) {
        const pronoun = tags.username in pronoun_DB ?
            pronoun_DB[tags.username] :
            await fetch(PRONOUN_API_ENDPOINT + tags.username)
            .then(resp => resp.text())
            .then(JSON.parse)
            .then(pronouns => {
                if (pronouns.length) {
                    const pronoun = pronouns[0].pronoun_id;
                    pronoun_DB[tags.username] = pronoun;
                    return pronoun;
                }
            });
        if (pronoun && FEM_PRONOUNS.some(g => g == pronoun)) voice = voiceSelect.value;
    }
    //*/
    if (lastUsername !== tags.username) {
        fetchAudio(`${tags.username} dice:  ${msg}`, voice);
        lastUsername = tags.username;
    } else {
        fetchAudio(`  ${msg}`, voice);
    }
}

function insertText(txt) {
    add(document.createElement('br'));
    add(txt);
    Array.from(chatbox.children)
        .slice(maxMsgInChat, Infinity)
        .forEach(e => e.remove());
}
// Función para inicializar la aplicación
window.onload = async function() {
    audio = document.getElementById("audio");
    chatbox = document.getElementById("chatbox");
    button = document.getElementById("channel-button");
    skip = document.getElementById("skip-button");
    channelInput = document.getElementById("channel");
    isPlaying = false;
    add = (DESCENDING ? chatbox.prepend : chatbox.append).bind(chatbox);
    audioqueue = new Queue();
    button.onclick = changeChannel;
    skip.onclick = skipAudio;
    document.addEventListener("keyup", ({ key }) => {
        if (key == "Enter") changeChannel();
    });
    audio.onended = kickstartPlayer;
    client = tmi.client();
    await client.connect()
        .then(() => {
            const hashVal = window.location.hash.slice(1);
            if (hashVal.length) {
                channelInput.value = hashVal;
                return changeChannel();
            }
        }).catch(e => console.error('no se pudo conectar a twitch:', e))
    client.on('chat', onMessage);
}