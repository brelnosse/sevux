var gamezone = document.querySelector('.gamezone'),
 	weapon = document.querySelector('.weapon'),
 	angle = 0,
	score = 0,
	x = 0,
	y = 0,
	life = 1,
	time = 1000,
	bool = true,
	bossLife = 5,
	bossSpeed = 100;
finals.innerHTML = bossLife;
// function pause(){
// 	document.removeEventListener('keydown', weaponDirection, false);
// 	document.removeEventListener('keydown', createBall, false);
// 	document.removeEventListener('keydown', byTouch, false);
// 	play.removeEventListener('click', init, false);
// }
var fin = document.createElement('div');
	fin.classList.add('targets');
function byTouch(e){
	e = e || window.event;
	if(e.keyCode == 13){
		init();
		bool = false;
	}
}
document.addEventListener('keypress', byTouch, false);

var dLevel = document.querySelectorAll('.niv');

for(var i = 0; i < dLevel.length; i++){
	dLevel[i].addEventListener('click', function(e){
		e.target.parentNode.style.display="none";
		if(this.classList[0] == 'easy'){
			time = 4000;
			bossSpeed = 100;
		}else if(this.classList[0] == 'med'){
			time = 3000;
			bossSpeed = 50;
		}else if(this.classList[0] =='hard'){
			time = 1000;
			bossSpeed = 25;
		}
	})
}

function init(e){
	animateTarget();
	document.addEventListener('keydown', weaponDirection, false);
	document.addEventListener('keydown', createBall, false);
	play.parentNode.style.display="none";
	h.style.display = "none";
}
play.addEventListener('click', init, false);

function createTarget(){
	for(var i = 0; i < 10; i++){
		var target = document.createElement('div');
			target.className = 'target';
			x = Math.floor(Math.random()*(540));
			y = -Math.floor(Math.random()*(360));
			target.style.top = y + 'px';
			target.style.left = x + 'px';
		gamezone.appendChild(target);
	}
}
createTarget();

/*-------------we animate targets's face-----------*/

var changeTargetFace = setInterval(function(){
	for(var i = 0; i < targets.length; i++){
		targets[i].classList.toggle('face');
	}
},500)


var targets = document.querySelectorAll('.target'),
 	targetsLengthInst = targets.length,
 	targetPosY = 0;


targetsLength.innerHTML = targetsLengthInst;
dsph.innerHTML = targetsLengthInst;
displayAngle.innerHTML = angle +' °';
var bg;

function animateTarget(){

	var timeLeft = setInterval(function(){
		for (var i = 0; i < targets.length; i++) {

			if(parseInt(targets[i].style.top) >= 310){
				var limite = document.querySelectorAll('.line');

				for(var j = 0; j < limite.length; j++){
					limite[j].style.boxShadow = "0px 0px 16px 5px rgba(255,0,0,0.5)";
				}
			}

			if(parseInt(targets[i].style.top)+60 >= 460){
				life --;
				lifeState.innerHTML = life;
			}

			if(life < 1){
				clearInterval(changeTargetFace);
				document.removeEventListener('keydown', weaponDirection, false);
				document.removeEventListener('keydown', createBall, false);
				clearInterval(timeLeft);
				lose.style.top = "0";
				finalScoreLost.innerHTML = score;
				life = 1;
			}
			targetPosY = parseInt(targets[i].style.top);
			targetPosY += 40;
			targets[i].style.top = targetPosY + 'px';
		}
	},time);

	var last = setInterval(function(){
		if(targets.length!=0){
			if((targets.length - score) <= 0){
					fin.style.background = 'finalboss.png';
					 bosMove = setInterval(function(){			
						fin.classList.toggle('bface');
						bossLeft = parseInt(getComputedStyle(fin).left);
						bossTop = parseInt(getComputedStyle(fin).top);
						if(bossLeft+60 >= 600){
							bossLeft = -60;
							bossTop += 60 
						}
						if(bossTop+60 > 520){
							clearInterval(bosMove);
							clearInterval(changeTargetFace);
							document.removeEventListener('keydown', weaponDirection, false);
							document.removeEventListener('keydown', createBall, false);
							clearInterval(timeLeft);
							lose.style.top = "0";
							finalScoreLost.innerHTML = score;
							life = 1;
						}
						fin.style.left = (bossLeft+=5) + 'px';
						fin.style.top = (bossTop) + 'px';
					},bossSpeed)
				gamezone.appendChild(fin);
				// won.style.top = "0"
				// clearInterval(timeLeft)
				// clearInterval(changeTargetFace)
				// finalScoreWin.innerHTML = score;
				// document.removeEventListener('keydown', createBall, false)
				// document.removeEventListener('keydown', weaponDirection, false)
				// weapon.style.bottom = "100px";
				// weapon.classList.add('victoryDance')
			clearInterval(last)

			}
	}
	},1000);
}
function bossDeath(cur, ballLeft, ballTop, bossTops, bossLefts,x,y){
	if(ballLeft <= bossLefts+60 && ballLeft >= bossLefts){
		if(ballTop <= bossTops+90 && ballTop >= bossTops){
			console.log(ballTop)
			bossLife--;
			finals.innerHTML = bossLife;
			cur.style.top = ballTop + 'px';
			cur.style.left = ballLeft + 'px';
			cur.remove()
			cur.style.left = '-200px'
			if(bossLife == 0){
				won.style.top = "0";
				finalScoreWin.innerHTML = score;
				document.removeEventListener('keydown', createBall, false)
				document.removeEventListener('keydown', weaponDirection, false)
				weapon.style.bottom = "100px";
				weapon.classList.add('victoryDance')	
				clearInterval(bosMove)			
			}
		}
	}	
}
function createBall(e){
	e = e || document.event;
	if(e.keyCode === 38){
		var ball = document.createElement('div');
			ball.className = "ball";
		gamezone.appendChild(ball);

		animateBall(ball);
	}	
}

function weaponDirection(e){
	e = e || window.event;
	if(angle < 0){
		displayAngle.innerHTML = -angle+'°';			
	}else{
		displayAngle.innerHTML = angle+'°';
	}
	if(e.keyCode == 37){
		angle -= 5;
		if(angle < -45){
			angle += 5
		}
		weapon.style.transform = "rotate("+angle+"deg)";	
	}

	if(e.keyCode == 39){
		angle += 5;
		if(angle > 45){
			angle -= 5
		}
		weapon.style.transform = "rotate("+angle+"deg)";
	}

}

function checkCollision(cur, ballTop, ballLeft, x, y){
	 setInterval(()=>{
		ballLeft += x;
		ballTop -= y;
		cur.style.top = ballTop + 'px';
		cur.style.left = ballLeft + 'px';
		if(ballTop <= 0){
			cur.remove();
			cur.style.top="0px"
		}
		for(var i = 0; i < targets.length; i++){
			if(ballTop <= parseInt(getComputedStyle(targets[i]).top)+60 && ballTop >= parseInt(getComputedStyle(targets[i]).top)){
				if(ballLeft+8 >= parseInt(getComputedStyle(targets[i]).left) && ballLeft+8 <= parseInt(getComputedStyle(targets[i]).left)+60){
					ballLeft = -100;
					var aud = document.createElement('audio');
					aud.src = 'shoot.mp3';
					aud.volume = 0.2;
					aud.play();
					cur.style.left = ballLeft + 'px';
					cur.remove();
					dsph.innerHTML = --targetsLengthInst;
					targets[i].style.top = "-100000px";
					targets[i].style.left = "-100%";
					targets[i].remove();
					score += 1;
					scores.innerHTML = score;
				}else{

				}
			}else{
			}
		}	
		bossDeath(cur,ballLeft, ballTop, parseInt(getComputedStyle(fin).top), parseInt(getComputedStyle(fin).left))

	 },10);	
}

function animateBall(elem){
	var elemTop = parseInt(getComputedStyle(elem).top);
	var elemLeft = parseInt(getComputedStyle(elem).left);

	if(angle == 0){
		checkCollision(elem, elemTop, elemLeft, 0, 10)
	
	}
	else if(angle == -5){
		checkCollision(elem, elemTop, elemLeft, -2, 16)
	
	}
	else if(angle == -10){
		checkCollision(elem, elemTop, elemLeft, -4, 16)
	
	}
	else if(angle == -15){
		checkCollision(elem, elemTop, elemLeft, -6, 16)
	
	}
	else if(angle == -20){
		checkCollision(elem, elemTop, elemLeft, -8, 16)

	}
	else if(angle == -25){
		checkCollision(elem, elemTop, elemLeft, -9.4, 16)

	}
	else if(angle == -30){
		checkCollision(elem, elemTop, elemLeft, -11, 16)

	}
	else if(angle == -35){
		checkCollision(elem, elemTop, elemLeft, -13, 16)
	
	}
	else if(angle == -40){
		checkCollision(elem, elemTop, elemLeft, -17, 16)
	
	}
	else if(angle == -45){
		checkCollision(elem, elemTop, elemLeft, -22, 16)

	}

	//RIGHT SIDE


	else if(angle == 5){
		checkCollision(elem, elemTop, elemLeft, 2, 16)

	}
	else if(angle == 10){
		checkCollision(elem, elemTop, elemLeft, 4, 16)

	}
	else if(angle == 15){
		checkCollision(elem, elemTop, elemLeft, 6, 16)

	}
	else if(angle == 20){
		checkCollision(elem, elemTop, elemLeft, 8, 16)
	
	}
	else if(angle == 25){
		checkCollision(elem, elemTop, elemLeft, 9.4, 16)
	
	}
	else if(angle == 30){
		checkCollision(elem, elemTop, elemLeft, 11, 16)
	
	}
	else if(angle == 35){
		checkCollision(elem, elemTop, elemLeft, 13, 16)
	
	}
	else if(angle == 40){
		checkCollision(elem, elemTop, elemLeft, 17, 16)
	}
	else if(angle == 45){
		checkCollision(elem, elemTop, elemLeft, 22, 16)

	}
}

