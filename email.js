(function() {
    var el = document.getElementById('email-link');
    if (!el) return;
    var p = ['b','e','n'];
    var d = ['b','e','n','j','a','m','i','n','m','e','a','d','o','w','s'];
    el.href = 'mai' + 'lto:' + p.join('') + '@' + d.join('') + '.com';
})();
