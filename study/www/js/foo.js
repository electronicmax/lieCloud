$.ajax({
	url:'/set', 
	method:'POST',
	processData:false,
	data:JSON.stringify({ id:'bunnies', data:{foo:'bar'}}),
    contentType: 'application/json'
}).then(function(x) { console.log('done', x); }).fail(function(err) { console.error(err); })