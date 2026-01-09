const canvas = document.getElementById('stars-canvas');
const ctx = canvas.getContext('2d');

let stars = [];
const starCount = 200;

function init() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    stars = [];
    for (let i = 0; i < starCount; i++) {
        stars.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            size: Math.random() * 8 + 4, // Bigger stars
            speed: Math.random() * 0.2 + 0.05,
            opacity: Math.random() * 0.6 + 0.2,
            blink: Math.random() * 0.02 + 0.005
        });
    }
}

function drawFourPointStar(x, y, size, opacity) {
    ctx.save();
    ctx.translate(x, y);

    // Draw the spikes
    ctx.beginPath();
    ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;

    // Vertical Spike
    ctx.moveTo(0, -size);
    ctx.lineTo(size * 0.15, 0);
    ctx.lineTo(0, size);
    ctx.lineTo(-size * 0.15, 0);
    ctx.closePath();
    ctx.fill();

    // Horizontal Spike
    ctx.beginPath();
    ctx.moveTo(-size, 0);
    ctx.lineTo(0, -size * 0.15);
    ctx.lineTo(size, 0);
    ctx.lineTo(0, size * 0.15);
    ctx.closePath();
    ctx.fill();

    // Add a center glow
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 0.4);
    gradient.addColorStop(0, `rgba(255, 255, 255, ${opacity})`);
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.6, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}

function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    stars.forEach(star => {
        star.y -= star.speed;
        if (star.y < -star.size) {
            star.y = canvas.height + star.size;
            star.x = Math.random() * canvas.width;
        }

        star.opacity += star.blink;
        if (star.opacity > 0.8 || star.opacity < 0.2) star.blink = -star.blink;

        drawFourPointStar(star.x, star.y, star.size, star.opacity);
    });

    requestAnimationFrame(animate);
}

window.addEventListener('resize', init);
init();
animate();
