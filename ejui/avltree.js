function AVLTreeNode(k, v)
{
    this.key = k;
    this.value = v;
    this.left = null;
    this.right = null;
    this.parent = null;
    this.height = 1;
    this.count = 1;
}

AVLTreeNode.prototype.update = function()
{
    if(this.left)
        this.left.parent = this;
    if(this.right)
        this.right.parent = this;
    this.height = 0;
    if(this.left && this.left.height > this.height)
        this.height = this.left.height;
    if(this.right && this.right.height > this.height)
        this.height = this.right.height;
    this.height++;
    this.count = 1;
    if(this.left)
        this.count += this.left.count;
    if(this.right)
        this.count += this.right.count;
}

AVLTreeNode.prototype.rotate = function(k1, k2)
{
    var ans = this[k1];
    ans.parent = this.parent;
    var tmp = ans[k2];
    ans[k2] = this;
    ans[k2]
    this[k1] = tmp;
    this.update();
    this.balance();
    ans.update();
    return ans;
}

AVLTreeNode.prototype.bigRotate = function(k1, k2)
{
    this[k1] = this[k1].rotate(k2, k1);
    this.update();
    return this.rotate(k1, k2);
}

AVLTreeNode.prototype.balance = function()
{
    var lh = (this.left?this.left.height:0);
    var rh = (this.right?this.right.height:0);
    var k1, k2;
    if(lh - rh > 1)
    {
        k1 = "left";
        k2 = "right";
    }
    else if(rh - lh > 1)
    {
        k1 = "right";
        k2 = "left";
    }
    else
        return this;
    var k1h = (this[k1][k1]?this[k1][k1].height:0);
    var k2h = (this[k1][k2]?this[k1][k2].height:0);
    if(k2h > k1h)
        return this.bigRotate(k1, k2);
    else
        return this.rotate(k1, k2);
}

AVLTreeNode.prototype.pop_right = function()
{
    if(this.right)
    {
        var ans = this.right.pop_right();
        this.right = ans.left;
        this.update();
        ans.left = this.balance();
        return ans;
    }
    else
    {
        this.height = 1;
        this.count = 1;
        return this;
    }
}

AVLTreeNode.prototype.pop_root = function()
{
    var p = this.parent;
    if(!this.left)
    {
        if(this.right)
            this.right.parent = p;
        return this.right;
    }
    var q = this.left.pop_right();
    q.right = this.right;
    q.update();
    q.parent = p;
    return q.balance();
}

AVLTreeNode.prototype.find_by_key = function(k, lb)
{
    if(k == this.key)
        return this;
    else if(k < this.key)
    {
        var ans = null;
        if(this.left)
            ans = this.left.find_by_key(k, lb);
        if(lb && !ans)
            ans = this;
        return ans;
    }
    else if(this.right)
        return this.right.find_by_key(k, lb);
}

AVLTreeNode.prototype.index_by_key = function(k)
{
    var lc = (this.left?this.left.count:0);
    if(k == this.key)
        return lc;
    else if(k < this.key)
    {
        if(this.left)
            return this.left.index_by_key(k);
    }
    else if(this.right)
    {
        var ans = this.right.index_by_key(k);
        if(ans >= 0)
            ans += lc + 1;
        return ans;
    }
    return -1;
}

AVLTreeNode.prototype.insert_by_key = function(node, pnode)
{
    if(node.key == this.key)
    {
        this.value = node.value;
        return pnode.node = this;
    }
    else if(node.key < this.key)
    {
        if(this.left)
            this.left = this.left.insert_by_key(node, pnode);
        else
            this.left = pnode.node = node;
    }
    else
    {
        if(this.right)
            this.right = this.right.insert_by_key(node, pnode);
        else
            this.right = pnode.node = node;
    }
    this.update();
    return this.balance();
}

AVLTreeNode.prototype.remove_by_key = function(k)
{
    if(k == this.key)
        return this.pop_root();
    else if(k < this.key)
    {
        if(this.left)
            this.left = this.left.remove_by_key(k);
    }
    else
    {
        if(this.right)
            this.right = this.right.remove_by_key(k);
    }
    this.update();
    return this.balance();
}

AVLTreeNode.prototype.find_by_idx = function(idx)
{
    if(idx < 0 || idx >= this.count)
        return null;
    var lc = (this.left?this.left.count:0);
    if(idx < lc)
        return this.left.find_by_idx(idx);
    else if(idx == lc)
        return this;
    else
        return this.right.find_by_idx(idx - lc - 1);
}

AVLTreeNode.prototype.append = function(node)
{
    if(this.right)
        this.right = this.right.append(node);
    else
        this.right = node;
    this.update();
    return this.balance();
}

AVLTreeNode.prototype.insert_by_idx = function(idx, node)
{
    if(idx == this.count)
        return this.append(node);
    var lc = (this.left?this.left.count:0);
    if(idx == 0 && lc == 0)
    {
        this.left = node;
        this.update();
        return this.balance();
    }
    if(idx <= lc)
        this.left = this.left.insert_by_idx(idx, node);
    else
        this.right = this.right.insert_by_idx(idx - lc - 1, node);
    this.update();
    return this.balance();
}

AVLTreeNode.prototype.remove_by_idx = function(idx)
{
    if(idx < 0 || idx >= this.count)
        return this;
    var lc = (this.left?this.left.count:0);
    if(idx < lc)
        this.left = this.left.remove_by_idx(idx);
    else if(idx == lc)
        return this.pop_root();
    else
        this.right = this.right.remove_by_idx(idx);
    this.update();
    return this.balance();
}

AVLTreeNode.prototype.remove_self = function()
{
    var parent = this.parent;
    var old = this;
    var now = this.pop_root();
    while(parent !== null)
    {
        var parent2 = parent.parent;
        if(parent.left === old)
            parent.left = now;
        if(parent.right === old)
            parent.right = now;
        parent.update();
        old = parent;
        now = parent.balance();
        parent = parent2;
    }
    return now;
}

function AVLIterator(tr, node)
{
    this.tree = tr;
    this.node = node;
}

AVLIterator.prototype._next = function(k1, k2)
{
    if(this.node[k1])
    {
        var q = this.node[k1];
        while(q[k2])
            q = q[k2];
        this.node = q;
        return this;
    }
    var prev = this.node;
    var cur = prev.parent;
    while(cur && cur[k2] !== prev)
    {
        prev = cur;
        cur = cur.parent;
    }
    if(cur)
    {
        this.node = cur;
        return this;
    }
    return null;
}

AVLIterator.prototype.prev = function()
{
    return this._next('left', 'right');
}

AVLIterator.prototype.next = function()
{
    return this._next('right', 'left');
}

AVLIterator.prototype.pop = function()
{
    this.tree.root = this.node.remove_self();
    this.node = null;
}

AVLIterator.prototype.get = function()
{
    return {'key': this.node.key, 'value': this.node.value};
}

function AVLMap()
{
    this.root = null;
}

AVLMap.prototype.get = function(k, lb)
{
    if(this.root)
    {
        var node = this.root.find_by_key(k, lb);
        if(node)
            return node.value;
    }
    return null;
}

AVLMap.prototype.lower_bound = function(k)
{
    if(this.root)
    {
        var node = this.root.find_by_key(k, true);
        if(node)
            return {key: node.key, value: node.value};
    }
    return null;
}

AVLMap.prototype.set = function(k, v)
{
    var pnode = {};
    var node = new AVLTreeNode(k, v);
    if(this.root)
        this.root = this.root.insert_by_key(node, pnode);
    else
        this.root = pnode.node = node;
    return new AVLIterator(this, pnode.node);
}

AVLMap.prototype.del = function(k)
{
    if(this.root)
        this.root = this.root.remove_by_key(k);
}

AVLMap.prototype.index = function(k)
{
    if(this.root)
        return this.root.index_by_key(k);
    return -1;
}

AVLMap.prototype.get_by_index = function(idx)
{
    if(this.root)
    {
        var node = this.root.find_by_idx(idx);
        if(node)
            return {key: node.key, value: node.value};
    }
    return null;
}

AVLMap.prototype.get_iter = function(k)
{
    if(this.root)
    {
        var node = this.root.find_by_key(k, lb);
        if(node)
            return new AVLIterator(this, node);
    }
    return null;
}

AVLMap.prototype.get_iter_by_index = function(idx)
{
    if(this.root)
    {
        var node = this.root.find_by_idx(idx);
        if(node)
            return new AVLIterator(this, node);
    }
    return null;
}

AVLMap.prototype.length = function()
{
    if(!this.root)
        return 0;
    return this.root.count;
}

function AVLRope()
{
    this.root = null;
}

AVLRope.prototype.get = function(idx)
{
    if(this.root)
        return this.root.find_by_idx(idx).value;
    return null;
}

AVLRope.prototype.get_iter = function(idx)
{
    if(this.root)
        return new AVLIterator(this, this.root.find_by_idx(idx));
    return null;
}

AVLRope.prototype.insert = function(idx, val)
{
    var node = new AVLTreeNode(null, val);
    if(this.root)
        this.root = this.root.insert_by_idx(idx, node);
    else
        this.root = node;
    return new AVLIterator(this, node);
}

AVLRope.prototype.del = function(idx)
{
    if(this.root)
        this.root = this.root.remove_by_idx(idx);
}

AVLRope.prototype.length = function()
{
    if(!this.root)
        return 0;
    return this.root.count;
}
