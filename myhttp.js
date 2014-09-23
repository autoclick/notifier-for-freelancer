var myhttp = {};
myhttp.Getajax = function (indata) {

    $.ajax({
        url: indata.url,
        xhrFields: {
            withCredentials: true
        },
        //headers: {
        //    'Cookie': indata.cookie
        //},
        type: 'GET',
        dataType: indata.type || "json",
        success: function (g, f, h) {
            indata.success(g.data)
        },
        error: function (g, f, h) {
            indata.error('Error get feed data')
        }
    });
};
myhttp.Postajax = function (indata) {
    $.ajax({
        url: indata.url,
        xhrFields: {
            withCredentials: true
        },
        //headers: {
        //    'Cookie': indata.cookie
        //},
        type: 'POST',
        data: indata.paramt,
        dataType: indata.type || "json",
        contentType: (indata.media) ? false : "application/x-www-form-urlencoded",
        success: function (g, f, h) {
            indata.success(g.data)
        },
        error: function (g, f, h) {
            indata.error('Error post data')
        }
    });
};
//-----------------
