function AnimatedTable(cols)
{
    this.cols = cols;
    this.colsSet = {};
    for(var i = 0; i < this.cols.length; i++)
    {
        this.cols[i]._refcount = 0;
        this.colsSet[this.cols[i].id] = true;
    }
    this.theTable = document.createElement('table');
    this.theTH = document.createElement('tr');
    this.theTable.appendChild(this.theTH);
    this.rows = [];
    this.animating = false;
}

AnimatedTable.prototype.insertColumn = function(q, skip_row)
{
    if(!this.colsSet[q])
        throw new ReferenceError("wtf?");
    var idx = 0, i;
    for(i = 0; this.cols[i].id != q; i++) //SQUARE
        if(this.cols[i]._refcount > 0 || this.cols[i]._opacity !== undefined)
            idx++;
    var thNode = document.createElement('th');
    thNode.appendChild(document.createTextNode(this.cols[i].name));
    if(idx == this.theTH.length)
        this.theTH.appendChild(thNode);
    else
        this.theTH.insertBefore(thNode, this.theTH.childNodes[idx]);
    for(var j = 0; j < this.rows.length; j++)
    {
        var text = null;
        if(this.rows[j][q] !== undefined && this.rows[j] !== skip_row)
            text = this.rows[j][q];
        var cell = document.createElement('td');
        if(text !== null)
            cell.appendChild(document.createTextNode(text));
        var row = this.rows[j]._tr;
        if(idx == row.childNodes.length)
            row.appendChild(cell);
        else
            row.insertBefore(cell, row.childNodes[idx]);
    }
    this.cols[i]._opacity = 0;
    if(!this.animating)
        this.animate();
}

AnimatedTable.prototype.removeColumn = function(q)
{
    if(!this.colsSet[q])
        throw new ReferenceError("wtf?");
    var idx = 0, i;
    for(i = 0; this.cols[i].id != q; i++) //SQUARE
        if(this.cols[i]._refcount > 0 || this.cols[i]._opacity !== undefined)
            idx++;
    this.theTH.removeChild(this.theTH.childNodes[idx]);
    for(var j = 0; j < this.rows.length; j++)
        this.rows[j]._tr.removeChild(this.rows[j]._tr.childNodes[idx]);
}

AnimatedTable.prototype.increfColumn = function(q, skip_row)
{
    if(!this.colsSet[q])
        throw new ReferenceError("wtf?");
    var i;
    for(i = 0; this.cols[i].id != q; i++); //SQUARE
//  console.log("incref", q, this.cols[i]._refcount);
    if(!(this.cols[i]._refcount++) && this.cols[i]._opacity === undefined)
        this.insertColumn(q, skip_row);
}

AnimatedTable.prototype.decrefColumn = function(q)
{
    if(!this.colsSet[q])
        throw new ReferenceError("wtf?");
    var i;
    for(i = 0; this.cols[i].id != q; i++); //SQUARE
//  console.log("decref", q, this.cols[i]._refcount);
    if(!--this.cols[i]._refcount)
    {
        this.cols[i]._opacity = 1;
        if(!this.animating)
            this.animate();
    }
}

AnimatedTable.prototype.insertRow = function(r)
{
    var i;
    for(i = 0; i < this.rows.length && this.rows[i] != r._insertBefore; i++); //SQUARE
    this.rows.splice(i, 0, r);
    r._tr = document.createElement('tr');
    for(var j = 0; j < this.cols.length; j++)
        if(this.cols[j]._refcount > 0 || this.cols[j]._opacity > 0)
            r._tr.appendChild(document.createElement('td'));
    var tbody = this.theTH.parentNode;
    i++;
    if(i == tbody.childNodes.length)
        tbody.appendChild(r._tr);
    else
        tbody.insertBefore(r._tr, tbody.childNodes[i]);
    r._opacity = 0;
    if(!this.animating)
        this.animate();
}

AnimatedTable.prototype.updateRow = function(r)
{
    var old_toremove = r._toremove;
    r._toremove = false;
    if(!r._tr)
        this.insertRow(r);
    for(var i = 0; i < this.cols.length; i++)
        if(this.cols[i].id in r && r[this.cols[i].id] !== null && r[this.cols[i].id] !== undefined)
            this.increfColumn(this.cols[i].id, r);
    var idx = 0;
    if(!old_toremove)
    {
//      console.log("update decref");
//      console.log(r._tr.innerHTML);
        for(var i = 0; i < this.cols.length; i++)
            if(this.cols[i]._refcount > 0 || this.cols[i]._opacity !== undefined)
                if(r._tr.childNodes[idx++].childNodes.length)
                    this.decrefColumn(this.cols[i].id);
//      console.log("update decref end");
    }
    else
//      console.log("reinsert");
    idx = 0;
    for(var i = 0; i < this.cols.length; i++)
        if(this.cols[i]._refcount > 0 || this.cols[i]._opacity !== undefined)
        {
            var td = r._tr.childNodes[idx++];
            var data = r[this.cols[i].id];
            while(td.firstChild)
                td.removeChild(td.firstChild);
            if(data !== null && data !== undefined)
                td.appendChild(document.createTextNode(data));
        }
}

AnimatedTable.prototype.removeRow = function(r)
{
    if(r._toremove)
        return;
    for(var i = 0; i < this.cols.length; i++)
        if(this.cols[i].id in r && r[this.cols[i].id] !== null && r[this.cols[i].id] !== undefined)
            this.decrefColumn(this.cols[i].id, r.id);
    r._toremove = true;
    if(r._opacity === undefined)
        r._opacity = 1;
    if(!this.animating)
        this.animate();
}

AnimatedTable.prototype.animate = function()
{
    this.animating = true;
    var dirty = false;
    for(var i = 0; i < this.rows.length; i++) //SQUARE
        if(this.rows[i]._opacity !== undefined)
            for(var j = 0; j < this.rows[i]._tr.childNodes.length; j++)
                this.rows[i]._tr.childNodes[j].style.opacity = this.rows[i]._opacity;
    var idx = 0;
    for(var i = 0; i < this.cols.length; i++)
    {
        if(this.cols[i]._opacity !== undefined)
        {
            this.theTH.childNodes[idx].style.opacity = this.cols[i]._opacity;
            for(var j = 0; j < this.rows.length; j++)
            {
                var op = this.cols[i]._opacity;
                if(this.rows[j]._opacity !== undefined && this.rows[j]._opacity < op)
                    op = this.rows[j]._opacity;
                this.rows[j]._tr.childNodes[idx].style.opacity = op;
            }
        }
        if(this.cols[i]._refcount > 0 || this.cols[i]._opacity !== undefined)
            idx++;
    }
    for(var i = 0; i < this.rows.length; i++) //SQUARE
        if(this.rows[i]._opacity !== undefined)
        {
            this.rows[i]._opacity = (this.rows[i]._toremove?animateRemove:animateInsert)(this.rows[i]._opacity);
            if(this.rows[i]._opacity === undefined && this.rows[i]._toremove)
            {
                if(this.rows[i]._onremove)
                    this.rows[i]._onremove();
                this.rows[i]._tr.parentNode.removeChild(this.rows[i]._tr);
                delete this.rows[i]._tr;
                this.rows.splice(i--, 1);
            }
            else if(this.rows[i]._opacity !== undefined)
                dirty = true;
        }
    for(var i = 0; i < this.cols.length; i++) //SQUARE
        if(this.cols[i]._opacity !== undefined)
        {
            this.cols[i]._opacity = (this.cols[i]._refcount?animateInsert:animateRemove)(this.cols[i]._opacity);
            if(this.cols[i]._opacity === undefined && this.cols[i]._refcount == 0)
                this.removeColumn(this.cols[i].id);
            if(this.cols[i]._opacity !== undefined)
                dirty = true;
        }
    if(dirty)
        requestAnimationFrame(this.animate.bind(this));
    else
        this.animating = false;
}

AnimatedTable.prototype.stopAnimation = function()
{
    for(var i = 0; i < this.cols.length; i++)
        if(this.cols[i]._opacity !== undefined)
            this.cols[i]._opacity = 1;
    for(var i = 0; i < this.rows.length; i++)
        if(this.rows[i]._opacity !== undefined)
            this.rows[i]._opacity = 1;
}

function animateInsert(opacity)
{
    if(opacity === 1)
        return undefined;
    opacity = Math.pow(opacity, 1/3);
    opacity += 1/60;
    opacity = Math.pow(opacity, 3);
    if(opacity > 1)
        opacity = 1;
    return opacity;
}

function animateRemove(opacity)
{
    if(opacity === 0)
        return undefined;
    opacity = Math.pow(opacity, 1/3);
    opacity -= 1/30;
    opacity = Math.pow(opacity, 3);
    if(opacity < 0)
        opacity = 0;
    return opacity;
}
