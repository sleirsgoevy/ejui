function requestAnimation(elem, prop, prefix, start, duration, stop, suffix)
{
    if(elem.ejuiAnimation)
        elem.ejuiAnimation.cancel = true;
    if(start === null)
    {
        start = elem.style[prop];
        start = +start.substr(prefix.length, start.length - prefix.length - suffix.length);
    }
    var canceller = {cancel: false};
    var startTime = +new Date();
    function callback()
    {
        if(canceller.cancel)
            return;
        var curTime = +new Date();
        if(curTime > startTime + duration)
        {
            elem.style[prop] = prefix+stop+suffix;
            return;
        }
        var curValue = start + (stop - start) * (curTime - startTime) / duration;
        elem.style[prop] = prefix+curValue+suffix;
        requestAnimationFrame(callback);
    }
    requestAnimationFrame(callback);
    return elem.ejuiAnimation = canceller;
}

function sinewaveAnimation(o)
{
    if(!this.timestamp)
    {
        this.timestamp = +new Date();
        this.angle = Math.asin(2*o-1);
    }
    var ts2 = +new Date();
    this.angle += (ts2 - this.timestamp)*Math.PI/1000;
    this.timestamp = ts2;
    return (Math.sin(this.angle)+1)/2;
}

function select_item(id)
{
    var elems = document.getElementsByClassName('selected');
    for(var i = 0; i < elems.length; i++)
    {
        var attr = elems[i].getAttribute('data-color1');
        if(attr !== null)
            elems[i].style.background = attr;
        elems[i].className = '';
    }
    var elem = document.getElementById('toolbar_item_'+id);
    var attr = elem.getAttribute('data-color2');
    if(attr !== null)
        elem.style.background = attr;
    elem.className = 'selected';
}

function Submission(tbl, id, task, status, score)
{
    this.tbl = tbl;
    this.id = id;
    this.task = task;
    this.s_id = ''+id;
    this.status = status;
    this.score = score;
    this.updateBackgroundColor();
    this.protocol_link = document.createElement('a');
    this.protocol_link.href = '/submissions/'+id;
    this.protocol_link.appendChild(document.createTextNode('Show protocol'));
    this.css_transition = 'background-color 0.25s ease-out';
    this.css_backgroundColor = '#ffffff';
    this.tbl.submById.set(id, this);
    this.polling = false;
    this._animation = null;
}

Submission.prototype._onremove = function()
{
    this.tbl.submById.del(this.id);
}

Submission.prototype.update = function(status, score)
{
    this.status = status;
    this.score = score;
    this.updateBackgroundColor();
    if(!this._toremove)
        this.tbl.tbl.updateRow(this);
}

Submission.prototype.updateBackgroundColor = function()
{
    if(this.still_running())
    {
        this._animation = sinewaveAnimation;
        this.css_backgroundColor = '#ffffff';
    }
    else
    {
        this._animation = null;
        var score = this.score || 0;
        if(this.status == 'OK')
            score = 100;
        var green = Math.floor(127*(score/100));
        var red = 127-green;
        var hex = "0123456789abcdef";
        this.css_backgroundColor = '#'+hex[8+(red-red%16)/16]+hex[red%16]+hex[8+(green-green%16)/16]+hex[green%16]+'80';
    }
}

Submission.prototype.still_running = function(s)
{
    if(s === undefined)
        s = this.status;
    return (s.substr(s.length-3) === '...' || s.indexOf(', ') >= 0 || {'Compiling': true, 'Running': true, 'Judging': true, 'Check failed': true, 'Available for testing': true, 'Full rejudge': true, 'Pending check': true, 'Pending judgement': true, 'Queue judge': true}[s]);
}

Submission.prototype.maybe_poll = function()
{
    if(this.still_running())
        this.poll();
}

Submission.prototype.poll = function()
{
    if(this.polling)
        return;
    this.polling = true;
    if(this.id in submPreload)
    {
        this.update(submPreload[this.id].status, submPreload[this.id].score);
        if(!this.still_running()) // otherwise we'd have stale status in submPreload
            return;
    }
    var self = this;
    var xhr = new XMLHttpRequest();
    xhr.open('GET', '/api/submission_list/'+this.id, true);
    xhr.send('');
    xhr.onload = function()
    {
        try
        {
            var data = JSON.parse(xhr.responseText);
        }
        catch(e)
        {
            self.polling = false;
            self.poll();
            return;
        }
        submPreload[self.id] = data;
        self.update(data.status, data.score);
        self.polling = false;
        self.maybe_poll();
    }
    xhr.onerror = function()
    {
        self.polling = false;
        self.poll();
        return;
    }
}

function SubmissionTable(task_id, hlevel)
{
    this.task_id = task_id;
    this.tbl = new AnimatedTable([{id: 's_id', name: 'ID'}, {id: 'task', name: 'Task'}, {id: 'status', name: 'Status'}, {id: 'score', name: 'Score'}, {id: 'protocol_link', name: 'Protocol'}], ['backgroundColor']);
    this.tbl.theTable.setAttribute('cellspacing', '0');
    this.tbl.theTable.border = 1;
    this.theTable = document.createElement('span');
    this.theTable.appendChild(document.createElement('h'+(task_id===undefined?'1':'2')));
    this.theTable.childNodes[0].appendChild(document.createTextNode('Submissions'));
    this.theTable.appendChild(this.tbl.theTable);
    this.theSpan = document.createElement('p');
    this.theSpan.appendChild(document.createTextNode('You have no submissions.'));
    this.submById = new AVLMap();
    this.refresh(subms);
    this.tbl.stopAnimation();
}

SubmissionTable.prototype.getNode = function()
{
    return (this.tbl.rows.length()?this.theTable:this.theSpan);
}

SubmissionTable.prototype.render = function(node)
{
    var elem1 = node.firstChild;
    var elem2 = this.getNode();
    if(elem1 !== elem2)
    {
        node.insertBefore(elem2, elem1);
        if(elem1 !== null)
            node.removeChild(elem1);
    }
}

SubmissionTable.prototype.refresh = function(subms)
{
    var ids = {};
    var ans = false;
    for(var i = subms[0].length - 1; i >= 0; i--)
    {
        if(subms[1][i] !== this.task_id && this.task_id !== null && this.task_id !== undefined)
            continue;
        ids[subms[0][i]] = true;
        var lb = this.submById.lower_bound(subms[0][i]);
        var insert_at = (lb===null?0:this.submById.length()-this.submById.index(lb.key));
        var subm = this.submById.get(subms[0][i]);
        if(subm === null)
        {
            ans = true;
            subm = new Submission(this, subms[0][i], subms[1][i], 'Polling...', null);
        }
        if(subm._toremove)
            ans = true;
        subm._insertAt = insert_at;
        this.tbl.updateRow(subm);
        subm.maybe_poll();
    }
    for(var i = 0; i < this.tbl.rows.length(); i++) //TODO: proper iterator
        if(!ids[this.tbl.rows.get(i).id])
            this.tbl.removeRow(this.tbl.rows.get(i));
    return ans;
}

var subms = [];
var submsLoaded = false;
var subm_table = null;

function checkSubmissions(j4f)
{
    if(checkSubmissions.timer !== undefined)
        clearTimeout(checkSubmissions.timer);
    var xhr = new XMLHttpRequest();
    xhr.open('GET', '/api/submission_list', true);
    xhr.send('');
    xhr.onload = function()
    {
        try
        {
            var data = JSON.parse(this.responseText).list;
        }
        catch(e)
        {
            checkSubmissions(j4f);
            return;
        }
        subms = data;
        if(!submsLoaded)
            initSubmissionTable();
        submsLoaded = true;
        if(subm_table !== null)
        {
            if(!subm_table.refresh(subms) && !j4f)
                alert("Submission failed!");
            var b = document.getElementById('submissions');
            if(b !== null)
                subm_table.render(b);
        }
        checkSubmissions.timer = setTimeout(checkSubmissions.bind(window, true), 5000);
    }
}

function submitSolution()
{
    var cmpl = document.getElementById('cmpl');
    if(cmpl === null)
        cmpl = '0';
    else
    {
        cmpl = Number(cmpl.value);
        if((''+cmpl) == 'NaN')
            cmpl = '0';
    }
    var file = document.getElementById('file');
    if(file.files.length == 0)
    {
        alert("No file selected!");
        return;
    }
    var xhr = new XMLHttpRequest();
    xhr.open('POST', '/submit/'+document.location.pathname.substr(6)+'/'+cmpl, true);
    xhr.onload = function()
    {
        if(this.responseText)
            alert(this.responseText);
        checkSubmissions(false);
    }
    xhr.onerror = function()
    {
        if(this.responseText)
            alert(this.responseText);
    }
    var fr = new FileReader();
    fr.onload = function()
    {
        xhr.send(this.result);
        file.files.length = 0;
    }
    fr.readAsArrayBuffer(file.files[0]);
}

var origPage = document.location.pathname;
var currentTask = undefined;

function initSubmissionTable()
{
    if(currentTask === undefined)
    {
        currentTask = document.getElementById('task_name');
        if(currentTask !== null)
            currentTask = currentTask.childNodes[0].data;
    }
    var subms = document.getElementById('submissions');
    if(subms === null)
        return;
    while(subms.firstChild)
        subms.removeChild(subms.firstChild);
    subm_table = new SubmissionTable(currentTask===null?undefined:currentTask);
    subm_table.render(subms);
}

function doAjaxLoad(page)
{
    if(!submsLoaded)
    {
        document.location.replace(page);
        return;
    }
//  document.getElementById('body').innerHTML = '';
    if(subm_table !== null)
        subm_table = null;
    currentTask = null;
    setCover(true);
    if(page == '/')
    {
        select_item('main');
        document.getElementById('body').innerHTML = '<h1>This is EJUI!</h1>';
        setCover(false);
    }
    else if(page.substr(0, 6) == '/task/')
    {
        select_item('task'+page.substr(6));
        var xhr = new XMLHttpRequest();
        xhr.open('GET', '/api'+page, true);
        xhr.send('');
        xhr.onload = function()
        {
            setCover(false);
            var body = document.getElementById('body');
            body.innerHTML = '';
            var data = JSON.parse(xhr.responseText);
            currentTask = data.name;
            var h1 = document.createElement('h1');
            h1.appendChild(document.createTextNode('Task '+data.name));
            body.appendChild(h1);
            var h2 = document.createElement('h2');
            h2.appendChild(document.createTextNode('Submit a solution'));
            body.appendChild(h2);
            var form = document.createElement('form');
            form.id = 'submit_form';
            form.action = '/submit/'+document.location.pathname.substr(6);
            form.method = 'POST';
            form.enctype = 'multipart/form-data';
            form.onsubmit = function()
            {
                submitSolution();
                return false;
            }
            var formtab = document.createElement('table');
            var formTR = function(a, b, c)
            {
                var tr = document.createElement('tr');
                var td1 = document.createElement('td');
                if(a !== null)
                    td1.appendChild(a);
                var td2 = document.createElement('td');
                if(b !== null)
                    td2.appendChild(b);
                var td3 = document.createElement('td');
                if(c !== null)
                    td3.appendChild(c);
                tr.appendChild(td1);
                tr.appendChild(td2);
                tr.appendChild(td3);
                formtab.appendChild(tr);
            }
            if(data.compilers.length)
            {
                var compiler_select = document.createElement('select');
                compiler_select.id = 'cmpl';
                compiler_select.name = 'cmpl';
                var first_opt = document.createElement('option');
                first_opt.style.display = 'none';
                first_opt.setAttribute('selected', 'true');
                first_opt.appendChild(document.createTextNode('Select language...'));
                compiler_select.appendChild(first_opt);
                for(var i = 0; i < data.compilers.length; i++)
                {
                    var opt = document.createElement('option');
                    opt.setAttribute('data-short-name', data.compilers[i][1]);
                    opt.value = data.compilers[i][0];
                    opt.appendChild(document.createTextNode(data.compilers[i][2]));
                    compiler_select.appendChild(opt);
                }
                formTR(document.createTextNode('Language:'), compiler_select, null);
            }
            var ifile = document.createElement('input');
            ifile.id = 'file';
            ifile.type = 'file';
            ifile.name = 'file';
            formTR(document.createTextNode('Solution:'), ifile, null);
            var isubmit = document.createElement('input');
            isubmit.type = 'submit';
            isubmit.value = 'Submit a solution';
            var lask = document.createElement('a');
            lask.href = '/clars/submit/'+page.substr(6);
            lask.appendChild(document.createTextNode('Ask a question'));
            formTR(null, isubmit, lask);
            form.appendChild(formtab);
            body.appendChild(form);
            var span = document.createElement('span');
            span.id = 'submissions';
            subm_table = new SubmissionTable(currentTask);
            subm_table.render(span);
            body.appendChild(span);
        }
    }
    else if(page == '/submissions')
    {
        setCover(false);
        select_item('subms');
        var body = document.getElementById('body');
        body.innerHTML = '';
        var span = document.createElement('span');
        span.id = 'submissions';
        submTable = new SubmissionTable();
        submTable.render(span);
        body.appendChild(span);
    }
    else if(page.substr(0, 13) == '/submissions/')
    {
        select_item('subms');
        var xhr = new XMLHttpRequest();
        xhr.open('GET', '/api'+page, true);
        xhr.send('');
        xhr.onload = function()
        {
            setCover(false);
            document.getElementById('body').innerHTML = this.responseText;
        }
    }
    else if(page.substr(0, 11) == '/scoreboard')
    {
        select_item('scoreboard');
        var xhr = new XMLHttpRequest();
        xhr.open('GET', '/api'+page, true);
        xhr.send('');
        xhr.onload = function()
        {
            setCover(false);
            if(this.status == 500)
                select_item('error');
            document.getElementById('body').innerHTML = this.responseText;
        }
    }
    else
        document.location.replace(page);
}

function ajax_load(link)
{
    var path = link.getAttribute('href');
    if(path == '')
        return;
    history.pushState({"page": path}, "", path);
    doAjaxLoad(path);
}

window.onpopstate = function(e)
{
    if(e.state)
        doAjaxLoad(e.state.page);
    else
        doAjaxLoad(origPage);
}

/*setInterval(function()
{
    checkSubmissions(true);
}, 5000);*/

function setCover(f)
{
    var elem = document.getElementById('cover');
    if(f)
    {
        elem.style.display = 'block';
        requestAnimation(elem, 'opacity', '', null, 500, 0.3, '');
    }
    else
    {
        requestAnimation(elem, 'opacity', '', null, 100, 0, '');
        setTimeout(function()
        {
            if(!elem.ejuiAnimation.cancel)
                elem.style.display = 'none';
        }, 100);
    }
}

function domReady()
{
    var dyn_style = document.getElementById('dyn_style');
    if(dyn_style !== null)
        dyn_style.parentNode.removeChild(dyn_style);
    var elems = document.querySelectorAll('#header td > a');
    for(var i = 0; i < elems.length; i++)
        elems[i].style.background = elems[i].getAttribute(elems[i].className.indexOf('selected')>=0?'data-color2':'data-color1');
}

checkSubmissions(true);
