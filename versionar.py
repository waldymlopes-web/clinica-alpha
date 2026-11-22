# Marca todos os arquivos do sistema com a mesma versão, para o navegador sempre baixar a atualização.
# Uso: python3 versionar.py
import re, glob, time
V = time.strftime('%Y%m%d%H%M')
padrao = re.compile(r"""((?:from\s+|import\s*\(\s*)['"](?:\.{1,2}/)[^'"?]+\.js)(\?v=[\w]+)?(['"])""")
for f in glob.glob('js/**/*.js', recursive=True):
    s = open(f).read(); n = padrao.sub(lambda m: f"{m.group(1)}?v={V}{m.group(3)}", s)
    if n != s: open(f, 'w').write(n)
h = open('index.html').read()
h = re.sub(r'(js/main\.js|css/app\.css)(\?v=[\w]+)?', lambda m: f'{m.group(1)}?v={V}', h)
open('index.html', 'w').write(h)
print('versão', V)
