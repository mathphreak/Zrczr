// see http://paulirish.com/2011/requestanimationframe-for-smart-animating/

// shim layer with setTimeout fallback

(function(){

    window.requestAnimFrame = (function(){
      return  window.requestAnimationFrame       || 
              window.webkitRequestAnimationFrame || 
              window.mozRequestAnimationFrame    || 
              window.oRequestAnimationFrame      || 
              window.msRequestAnimationFrame     || 
              function(callback, element){
                window.setTimeout(function(){
                    callback(+new Date);
                }, 1000 / 60);
              };
    })();

})();
