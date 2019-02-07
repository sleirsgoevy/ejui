import brutejudge.http as bj, os, sys, socket, html
from brutejudge.error import BruteError

if len(sys.argv) != 3:
    sys.stderr.write("""\
usage: ejui.py <bind_addr> <tgt_addr>
""")
    exit(1)

host, port = sys.argv[1].split(':')
port = int(port)
tgt_addr = sys.argv[2]

from bottle import route, post, abort, request, response, redirect, run, static_file

sessions = {}

def get_session():
    sess_id = request.get_cookie('credentials', 'invalid')
    return sessions.get(sess_id, None)

@route('/')
def main_page():
    if get_session() == None:
        return static_file('login.html', 'ejui')
    with open('ejui/main.html') as file:
        return format_page('main', file.read())

@route('/app.js')
def app_js():
    return static_file('app.js', 'ejui')

@post('/')
def do_login():
    login = request.forms.get('login', default=None)
    pass_ = request.forms.get('pass', default=None)
    if login == None or pass_ == None:
        return redirect('/')
    message = None
    try: url, cookie = bj.login(tgt_addr, login, pass_)
    except (BruteError, socket.error) as e:
        message = str(e)
    except Exception:
        message = "Internal server error"
    if message != None:
        with open('ejui/error.html') as file:
            return file.read().format(message=html.escape(message))
    session_id = os.urandom(16).hex()
    sessions[session_id] = (url, cookie)
    response.set_cookie('credentials', session_id)
    return redirect('/')

def force_session():
    s = get_session()
    if s == None:
        redirect('/')
    return s

@route('/api/task/<task:int>')
def task_data(task, tl=None):
    task = int(task)
    url, cookie = force_session()
    if tl == None: tl = bj.task_list(url, cookie)
    if task not in range(len(tl)):
        abort(404)
    name = tl[task]
    tids = bj.task_ids(url, cookie)
    tid = tids[task]
    try: compilers = bj.compiler_list(url, cookie, tid)
    except BruteError: compilers = []
    return {'name': name, 'compilers': compilers}

@route('/task/<task:int>')
def task_page(task):
    task = int(task)
    url, cookie = force_session()
    tl = bj.task_list(url, cookie)
    td = task_data(task, tl=tl)
    with open('ejui/task.html') as file:
        t1 = file.read()
    with open('ejui/compiler.html') as file:
        t2 = file.read()
    subms, any_subms = format_submissions(td['name'])
    if any_subms:
        with open('ejui/task_subms.html') as file:
            subms = file.read().format(subms=subms)
    else:
        subms = ''
    compilers = ''
    for a, b, c in td['compilers']:
        compilers += t2.format(id=a, short_name=html.escape(b), long_name=html.escape(c))
    if td['compilers']:
        with open('ejui/compilers.html') as file:
            compilers = file.read().format(data=compilers)
    return format_page('task%d'%task, t1.format(id=task, name=html.escape(td['name']), subms=subms, compilers=compilers), tl=tl)

@post('/submit/<task:int>')
@post('/submit/<task:int>/<cmpl:int>')
def submit(task, cmpl=None):
    url, cookie = force_session()
    js = False
    if cmpl != None:
        js = True
        data = request.body.read()
    else:
        cmpl = int(request.forms.get('cmpl', '0'))
        file = request.files.get('file')
        if file == None:
            with open('ejui/no_file.html') as file:
                return format_page('error', file.read())
        data = file.file.read()
    bj.submit(url, cookie, task, cmpl, data)
    if not js:
        return redirect('/task/%d'%task)

@route('/submissions')
def submissions():
    subms, any_subms = format_submissions(None)
    if any_subms:
        with open('ejui/subms.html') as file:
            subms = file.read().format(subms=subms)
    else:
        with open('ejui/no_subms.html') as file:
            subms = file.read()
    return format_page('subms', subms)

@route('/api/submissions/<id:int>')
def format_protocol(id):
    id = int(id)
    url, cookie = force_session()
    tests, any_tests = format_tests(id)
    if not any_tests:
        tests = ''
    err = bj.compile_error(url, cookie, id)
    if err == None:
        err = ''
    else:
        with open('ejui/compile_error.html') as file:
            err = file.read().format(err=html.escape(err))
    with open('ejui/protocol.html') as file:
        return file.read().format(id=id, err=err, tests=tests)

@route('/submissions/<id:int>')
def protocol(id):
    return format_page('protocol', format_protocol(id))

@route('/api/submission_list')
def submission_list():
    url, cookie = force_session()
    return {"list": bj.submission_list(url, cookie)}

@route('/api/submission_list/<id:int>')
def submission_list_item(id):
    id = int(id)
    url, cookie = force_session()
    stats = bj.submission_stats(url, cookie, id)
    status = bj.submission_status(url, cookie, id)
    data = {'status': status}
    if 'score' in stats:
        data['score'] = stats['score']
    return data

@route('/api/stats/<id>')
def submission_stats(id):
    id = int(id)
    url, cookie = force_session()
    return bj.submission_stats(url, cookie, id)[0]

def format_page(page, text, tl=None):
    url, cookie = force_session()
    if tl == None: tl = bj.task_list(url, cookie)
    data = [('main', '/', '<b>ejui</b>')]
    for i, j in enumerate(tl):
        data.append(('task%d'%i, '/task/%d'%i, html.escape(j)))
    data2 = [('subms', '/submissions', 'Submissions')]
    head = ''
    for a, b, c in data:
        head += '<a id="'+a+'" href="'+b+'" onclick="ajax_load(this); return false"'
        if a == page:
            head += ' class=selected'
        head += '>'+c+'</a>'
    head += '<span class=to_right>'
    for a, b, c in data2:
        head += '<a id="'+a+'" href="'+b+'" onclick="ajax_load(this); return false"'
        if a == page:
            head += ' class=selected'
        head += '>'+c+'</a>'
    head += '</span>'
    if page.startswith('task'):
        curr_task = repr(tl[int(page[4:])])
    else:
        curr_task = 'null'
    with open('ejui/skel.html') as file:
        return file.read().format(task=curr_task, head=head, body=text)

def format_submissions(task=None):
    url, cookie = force_session()
    a, b = bj.submission_list(url, cookie)
    ans = ''
    have_score = False
    stats_arr = []
    for i, t in zip(a, b):
        if task in (t, None):
            stats = submission_stats(i)
            stats_arr.append(stats)
            if 'score' in stats: have_score = True
    with open('ejui/subm.html' if have_score else 'ejui/subm_no_score.html') as file:
        tt = file.read()
    stats_arr = iter(stats_arr)
    for i, t in zip(a, b):
        if task in (t, None):
            status = bj.submission_status(url, cookie, i)
            stats = next(stats_arr)
            ans += tt.format(id=i, task=html.escape(t), status=html.escape(status), score=stats.get('score', ''))
    with open('ejui/subms_t.html' if have_score else 'ejui/subms_no_score.html') as file:
        return (file.read().format(data=ans), b)

def format_tests(id):
    url, cookie = force_session()
    a, b = bj.submission_results(url, cookie, id)
    data = ''
    with open('ejui/test.html') as file:
        t = file.read()
    for i, (j, k) in enumerate(zip(a, b)):
        data += t.format(id=i+1, status=j, time=k)
    with open('ejui/tests.html') as file:
        return (file.read().format(data=data), a)

run(host=host, port=port)
