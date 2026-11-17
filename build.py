"""Gera o site (index.html e arquivos na raiz) a partir de src/.
Uso: python3 build.py   (rode na raiz do repositório)"""
import json,shutil,os,time
R=os.path.dirname(os.path.abspath(__file__)); S=os.path.join(R,'src')
cfg=json.load(open(os.path.join(S,'firebase.json')))
s=open(os.path.join(S,'central.html')).read()
def rep(a,b):
    global s
    assert a in s, 'trecho não encontrado: '+a[:80]; s=s.replace(a,b,1)
FB='https://www.gstatic.com/firebasejs/10.14.1/'
head=f'''<link rel="manifest" href="manifest.webmanifest">
<meta name="theme-color" content="#0c0f15">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<link rel="icon" href="favicon.png"><link rel="apple-touch-icon" href="apple-touch-icon.png">
<script src="{FB}firebase-app-compat.js"></script>
<script src="{FB}firebase-auth-compat.js"></script>
<script src="{FB}firebase-firestore-compat.js"></script>
<script>window.CENTRAL_FIREBASE={json.dumps(cfg)};</script>
<script>{open(os.path.join(S,'shim.js')).read()}</script>
'''
rep('<meta name="viewport" content="width=device-width, initial-scale=1">','<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'+head)
i=s.rfind('</style>'); s=s[:i]+open(os.path.join(S,'extra.css')).read()+s[i:]
rep("    banner('Modo de visualização: não foi possível conectar ao armazenamento, então nada do que você fizer aqui será salvo. Abra pelo link do Claude, com sua conta conectada.');",
    "    banner('Não foi possível conectar ao banco de dados. Verifique a internet e recarregue.');")
rep("if(c==='needs_reauth') return msg('A conexão com o Google Agenda expirou','Reconecte em claude.ai → Configurações → Conectores e depois clique em Atualizar.');",
    "if(c==='needs_reauth'||c==='approval_required') return msg('Conecte o Google Agenda','Toque no botão para a Central ler e salvar na sua agenda. A conexão dura cerca de 1 hora; depois é só tocar de novo.',`<button class=\"btn small primary\" data-gconnect style=\"margin-top:8px\">Conectar Google Agenda</button>`);")
rep("else if(c==='needs_reauth') toast('A conexão com o Google Agenda expirou. Reconecte em claude.ai → Configurações → Conectores.');",
    "else if(c==='needs_reauth'){ if(!window.__gcT||Date.now()-window.__gcT>600000){ window.__gcT=Date.now(); toast('Google Agenda desconectado: abra a aba Agenda e toque em Conectar.'); } }")
rep('    <button class="nav-item" id="backupBtn"></button>\n','    <button class="nav-item" id="backupBtn"></button>\n    <button class="nav-item" id="signOutBtn" type="button">Sair da conta</button>\n')
rep("banner(err&&err.code==='revoked'?'O acesso aos dados foi encerrado. Recarregue a página.':'Não foi possível sincronizar seus dados. Recarregue a página mais tarde.');",
    "banner(err&&err.code==='permission-denied'?'Sem permissão no banco de dados (permission-denied). Confira as Regras do Firestore no Firebase.':(err&&(err.code==='not-found'||err.code==='failed-precondition'))?'Banco de dados não encontrado ('+err.code+'). Confira se o Firestore foi criado com o ID (default).':'Não foi possível sincronizar seus dados ('+((err&&(err.code||err.message))||'erro')+'). Recarregue a página.'); console.error(err);")
rep("})();\n</script>\n</body>","""document.addEventListener('click',e=>{ if(e.target.closest('[data-gconnect]')) window.centralConnectGoogle(); if(e.target.closest('#signOutBtn')&&confirm('Sair da sua conta neste aparelho?')) window.centralSignOut(); });
document.addEventListener('central:gconnected',()=>{ agendaLoad(true); toast('Google Agenda conectado ✓'); });
})();
</script>
</body>""")
open(os.path.join(R,'index.html'),'w').write(s)
for f in ['manifest.webmanifest','icon-192.png','icon-512.png','icon-maskable-512.png','apple-touch-icon.png','favicon.png']:
    shutil.copy(os.path.join(S,f),os.path.join(R,f))
sw=open(os.path.join(S,'sw.js')).read().replace("const C='central-v1';",f"const C='central-{int(time.time())}';")
open(os.path.join(R,'sw.js'),'w').write(sw)
print('ok',len(s))
