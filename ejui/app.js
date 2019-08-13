function select_item(id)
{
    var elems = document.getElementsByClassName('selected');
    for(var i = 0; i < elems.length; i++)
        elems[i].className = '';
    document.getElementById(id).className = 'selected';
}

function Submission(id, task)
{
    this.id = id;
    this.task = task;
    this.data = {'status': 'Polling...'};
    this.render_table = null;
    this.render_tr = null;
    this.polling = false;
}

Submission.prototype.set_render = function(tb, tr)
{
    this.render_table = tb;
    this.render_tr = tr;
    this.render();
}

Submission.prototype.still_running = function(s)
{
    if(s === undefined)
        s = this.data.status;
    return (s.substr(s.length-3) === '...' || s.indexOf(', ') >= 0 || {'Compiling': true, 'Running': true, 'Judging': true, 'Check failed': true, 'Available for testing': true, 'Full rejudge': true, 'Pending check': true, 'Pending judgement': true}[s]);
}

Submission.prototype.maybePoll = function()
{
    if(this.still_running())
        this.poll();
}

Submission.prototype.render = function()
{
    if(this.render_tr === null || this.render_table === null)
        return;
    while(this.render_tr.firstChild)
        this.render_tr.removeChild(this.render_tr.firstChild);
    var pushTD = function(t)
    {
        var td = document.createElement('td');
        td.appendChild(document.createTextNode(t));
        this.render_tr.appendChild(td);
    }.bind(this);
    pushTD(this.id);
    pushTD(this.task);
    pushTD(this.data.status);
    if(this.render_table.has_scores)
        pushTD((this.data.score === undefined)?'':this.data.score);
    var td = document.createElement('td');
    var a = document.createElement('a');
    a.setAttribute('href', '/submissions/'+this.id);
    a.onclick = function()
    {
        ajax_load(this);
        return false;
    }
    a.appendChild(document.createTextNode('Show protocol'));
    td.appendChild(a);
    this.render_tr.appendChild(td);
    if(this.data.score !== undefined && !this.render_table.has_scores)
        this.render_table.refresh();
    if(this.still_running())
        this.poll();
}

Submission.prototype.renderStatusOnly = function()
{
    if(this.render_tr && this.render_tr.childNodes.length >= 4)
    {
        this.render_tr.childNodes[2].firstChild.data = this.data.status;
        this.maybePoll();
    }
    else
        this.render();
}

Submission.prototype.poll = function()
{
    if(this.polling)
        return;
    this.polling = true;
    var self = this;
    if(submPreload !== null && submPreload[this.id] !== undefined)
    {
        setTimeout(function()
        {
            this.polling = false;
            var cur = submPreload[self.id];
            delete submPreload[self.id];
            if(cur === undefined)
                self.poll();
            else
            {
                self.data = cur;
                self.render();
            }
        }, 0);
        return;
    }
    var xhr = new XMLHttpRequest();
    xhr.open('GET', '/api/submission_list/'+this.id, true);
    xhr.send('');
    xhr.onload = function() 
    {
        var score0 = self.data.score;
        this.polling = false;
        try
        {
            var data = JSON.parse(xhr.responseText);
        }
        catch(e)
        {
            self.poll();
            return;
        }
        if(this.still_running(data.status) || data.status !== self.data.status || data.score !== self.data.score)
        {
            if(self.data.score === data.score)
            {
                self.data = data;
                self.renderStatusOnly();
            }
            else
            {
                self.data = data;
                self.render();
            }
        }
        if((score0 === undefined) != (self.data.score === undefined) && this.render_table !== null)
            this.render_table.refresh();
    }.bind(this);
}

function SubmissionTable(subms, table)
{
    this.subms = subms;
    this.has_scores = false;
    this.table = table;
    if(this.table.lastChild && (''+this.table.lastChild.tagName).toLowerCase() == 'tbody')
       this.table = this.table.lastChild;
    this.table.innerHTML = '<tr><th>ID</th><th>Task</th><th>Status</th><th>Protocol</th></tr>';
    this.table_contents = [];
    this.animated = false;
    this.refresh();
    this.animated = true;
}

SubmissionTable.prototype.refresh = function()
{
    if(this.table.lastChild && (''+this.table.lastChild.tagName).toLowerCase() == 'tbody')
       this.table = this.table.lastChild;
    var subms = [];
    for(var i = 0; i < this.subms.length; i++)
        if(this.subms[i].task === currentTask || currentTask === null)
            subms.push(this.subms[i]);
    for(var i = 0; i < this.table_contents.length; i++)
        this.table_contents[i].tracked = true;
    for(var i = 0; i < subms.length; i++)
        delete subms[i].tracked;
    for(var i = 0; i < this.table_contents.length; i++)
        if(this.table_contents[i].tracked)
        {
            delete this.table_contents[i].tracked;
            this.animatedRemove(this.table_contents[i].render_tr, 'height');
            this.table_contents[i].set_render(null, null);
        }
    var prev = null;
    var have_scores = false;
    for(var i = subms.length - 1; i >= 0; i--)
    {
        if(subms[i].data.score !== undefined)
            have_scores = true;
        if(subms[i].render_tr === null)
        {
            subms[i].set_render(this, document.createElement('tr'));
            this.animatedInsert(subms[i].render_tr, 'height');
        }
        var tr = subms[i].render_tr;
        if(prev !== null)
            this.table.insertBefore(tr, prev);
        else
            this.table.appendChild(tr);
        prev = tr;
    }
    this.table_contents.length = 0;
    for(var i = 0; i < subms.length; i++)
        this.table_contents.push(subms[i]);
    if(have_scores != this.has_scores)
    {
        this.has_scores = have_scores;
        if(this.has_scores)
            this.addScores();
        else
            this.removeScores();
    }
}

SubmissionTable.prototype.animatedInsert = function(elem, property)
{
    if(!this.animated)
        return;
    elem.className = 'animated zero_'+property;
    setTimeout(function()
    {
        elem.className = 'animated';
    }, 1);
}

SubmissionTable.prototype.animatedRemove = function(elem, property)
{
    if(!this.animated)
    {
        elem.parentNode.removeChild(elem);
        return;
    }
    elem.className = 'animated';
    setTimeout(function()
    {
        elem.className = 'animated zero_'+property;
    }, 1);
    setTimeout(function()
    {
        if(elem.className == 'animated zero_'+property)
            elem.parentNode.removeChild(elem);
    }, 5000);
}

SubmissionTable.prototype.addScores = function()
{
    var scores = document.createElement('th');
    scores.appendChild(document.createTextNode('Score'));
    this.table.childNodes[0].insertBefore(scores, this.table.childNodes[0].childNodes[3]);
    this.animatedInsert(scores, 'width');
    for(var i = 1; i < this.table.childNodes.length; i++)
    {
        var tr = this.table.childNodes[i];
	var subm = this.table_contents[i - 1];
        if(tr.childNodes.length == 4)
	{
	    var scoreTD = document.createElement('td');
	    scoreTD.appendChild(document.createTextNode((subm.data.score !== undefined)?subm.data.score:''));
            tr.insertBefore(scoreTD, tr.childNodes[3]);
            this.animatedInsert(scoreTD, 'width');
	}
    }
}

SubmissionTable.prototype.removeScores = function()
{
    for(var i = 0; i < this.table.childNodes.length; i++)
    {
        var tr = this.table.childNodes[i];
        this.animatedRemove(tr.childNodes[2], 'width');
    }
}

SubmissionTable.prototype.destroy = function()
{
    for(var i = 0; i < this.table_contents.length; i++)
        this.table_contents[i].set_render(null, null);
}

var subms = [];
var submsLoaded = false;
var subm_table = null;

function anySubmissions()
{
    if(subms.length && currentTask === null)
        return true;
    for(var i = 0; i < subms.length; i++)
        if(subms[i].task === currentTask)
            return true;
    return false;
}

function checkSubmissions(j4f)
{
    if(!j4f && checkSubmissions.timer !== undefined)
        clearTimeout(checkSubmissions.timer);
    delete checkSubmissions.timer;
    var xhr = new XMLHttpRequest();
    xhr.open('GET', '/api/submission_list', true);
    xhr.send('');
    xhr.onload = function()
    {
        checkSubmissions.timer = setTimeout(checkSubmissions, 5000, true);
        var prev_len = subms.length;
        var data = JSON.parse(this.responseText);
        var subm_by_id = {};
        for(var i = 0; i < subms.length; i++)
            subm_by_id[subms[i].id] = subms[i];
        var have_new_subms = false;
        subms.length = 0;
        for(var i = 0; i < data.list[0].length; i++)
        {
            var id = data.list[0][i];
            var task = data.list[1][i];
            var subm = null;
            if(subm_by_id[id] === undefined)
            {
                subm = new Submission(id, task);
                have_new_subms = true;
            }
            else
                subm = subm_by_id[id];
            subms.push(subm);
        }
        if(submsLoaded && currentTask !== null && !have_new_subms && !j4f)
            alert("Submission failed!");
        if(subms.length && !prev_len && (document.location.pathname.substr(0, 6) == '/task/' || document.location.pathname == '/submissions'))
        {
            var a = document.getElementById('subm_cont');
            var b = document.getElementById('submissions');
            if(b === null)
            {
                if(a === null)
                    return;
                var h = (document.location.pathname.substr(0, 6) == '/task/')?'2':'1';
                a.innerHTML = '<h'+h+'>Submissions</h'+h+'><table id=submissions cellspacing=0 border=1><tr><td>ID</td><td>Task</td><td>Status</td><td>Protocol</td></tr></table>';
                b = document.getElementById('submissions');
            }
            subm_table = new SubmissionTable(subms, b);
            a.style.display = (subms.length?'inline':'none');
        }
        submsLoaded = true;
        if(subm_table !== null)
            subm_table.refresh();
    }
    xhr.onerror = checkSubmissions.bind(window, j4f);
}

function submitSolution()
{
    var cmpl = document.getElementById('cmpl');
    if(cmpl === null)
        cmpl = '0';
    else
    {
        cmpl = Number(cmpl.value);
        if(cmpl * 0)
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
    xhr.onload = checkSubmissions.bind(window, false);
    var fr = new FileReader();
    fr.onload = function()
    {
        xhr.send(this.result);
        file.files.length = 0;
    }
    fr.readAsArrayBuffer(file.files[0]);
}

var origPage = document.location.pathname;

function doAjaxLoad(page)
{
    if(!submsLoaded)
    {
        document.location.replace(page);
        return;
    }
    document.getElementById('body').innerHTML = '';
    if(subm_table !== null)
    {
        subm_table.destroy();
        subm_table = null;
    }
    currentTask = null;
    if(page == '/')
    {
        select_item('main');
        document.getElementById('body').innerHTML = '<h1>This is EJUI!</h1>';
    }
    else if(page.substr(0, 6) == '/task/')
    {
        select_item('task'+page.substr(6));
        var xhr = new XMLHttpRequest();
        xhr.open('GET', '/api'+page, true);
        xhr.send('');
        xhr.onload = function()
        {
            var body = document.getElementById('body');
            body.innerHTML = '';
            var data = JSON.parse(xhr.responseText);
            currentTask = data.name;
            var h1 = document.createElement('h1');
            h1.appendChild(document.createTextNode('Task '+data.name));
            body.appendChild(h1);
            var span = document.createElement('span');
            span.id = 'subm_cont';
            if(anySubmissions())
            {
                var h2 = document.createElement('h2');
                h2.appendChild(document.createTextNode('Submissions'));
                span.appendChild(h2);
                var subm_t = document.createElement('table');
                subm_t.setAttribute('cellspacing', '0');
                subm_t.setAttribute('border', '1');
                subm_t.innerHTML = '<tr><th>ID</th><th>Task</th><th>Status</th><th>Protocol</th></tr>';
                subm_table = new SubmissionTable(subms, subm_t);
                span.appendChild(subm_t);
            }
            body.append(span);
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
            var formTR = function(a, b)
            {
                var tr = document.createElement('tr');
                var td1 = document.createElement('td');
                if(a !== null)
                    td1.appendChild(a);
                var td2 = document.createElement('td');
                if(b !== null)
                    td2.appendChild(b);
                tr.appendChild(td1);
                tr.appendChild(td2);
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
                formTR(document.createTextNode('Language:'), compiler_select);
            }
            var ifile = document.createElement('input');
            ifile.id = 'file';
            ifile.type = 'file';
            ifile.name = 'file';
            formTR(document.createTextNode('Solution:'), ifile);
            var isubmit = document.createElement('input');
            isubmit.type = 'submit';
            isubmit.value = 'Submit a solution';
            formTR(null, isubmit);
            form.appendChild(formtab);
            body.appendChild(form);
        }
    }
    else if(page == '/submissions')
    {
        select_item('subms');
        var body = document.getElementById('body');
        var span = document.createElement('span');
        span.id = 'subm_cont';
        if(anySubmissions())
        {
            var h1 = document.createElement('h1');
            h1.appendChild(document.createTextNode('Submissions'));
            span.appendChild(h1);
            var subm_t = document.createElement('table');
            subm_t.setAttribute('cellspacing', '0');
            subm_t.setAttribute('border', '1');
            subm_t.innerHTML = '<tr><th>ID</th><th>Task</th><th>Status</th><th>Protocol</th></tr>';
            subm_table = new SubmissionTable(subms, subm_t);
            span.appendChild(subm_t);
        }
        else
            span.innerHTML = '<p>You have no submissions</p>';
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

checkSubmissions(true);
/*setInterval(function()
{
    checkSubmissions(true);
}, 5000);*/
