// Lightweight confetti utility
class Confetti {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.particles = [];
        this.resize();
        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    createParticle() {
        return {
            x: Math.random() * this.canvas.width,
            y: -20,
            size: Math.random() * 8 + 4,
            color: `hsl(${Math.random() * 360}, 70%, 60%)`,
            speed: Math.random() * 3 + 2,
            angle: Math.random() * Math.PI * 2,
            rotation: Math.random() * 0.2 - 0.1
        };
    }

    shoot() {
        const isAlreadyRunning = this.particles.length > 0;
        for (let i = 0; i < 100; i++) {
            this.particles.push(this.createParticle());
        }
        if (!isAlreadyRunning) {
            this.animate();
        }
    }

    animate() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        const fadeThreshold = this.canvas.height * 0.8;

        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.y += p.speed;
            p.x += Math.sin(p.angle) * 1;
            p.angle += p.rotation;

            // Fade out as it gets to the bottom
            const opacity = Math.max(0, 1 - (p.y / this.canvas.height));

            this.ctx.save();
            this.ctx.globalAlpha = opacity;
            this.ctx.fillStyle = p.color;
            this.ctx.translate(p.x, p.y);
            this.ctx.rotate(p.angle);
            this.ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
            this.ctx.restore();

            // Remove if past screen or faded
            if (p.y > this.canvas.height || opacity <= 0) {
                this.particles.splice(i, 1);
            }
        }

        if (this.particles.length > 0) {
            requestAnimationFrame(() => this.animate());
        }
    }
}

window.Confetti = Confetti;
