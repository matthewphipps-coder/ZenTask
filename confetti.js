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
        for (let i = 0; i < 100; i++) {
            this.particles.push(this.createParticle());
        }
        if (this.particles.length === 100) {
            this.animate();
        }
    }

    animate() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        const fadeHeight = this.canvas.height / 4;

        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.y += p.speed;
            p.x += Math.sin(p.angle) * 1;
            p.angle += p.rotation;

            // Calculate opacity based on distance: fades to 0 at 25% screen height
            const opacity = Math.max(0, 1 - (p.y / fadeHeight));

            this.ctx.save();
            this.ctx.globalAlpha = opacity;
            this.ctx.fillStyle = p.color;
            this.ctx.translate(p.x, p.y);
            this.ctx.rotate(p.angle);
            this.ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
            this.ctx.restore();

            // Remove if invisible or past the fade threshold
            if (opacity <= 0 || p.y > fadeHeight) {
                this.particles.splice(i, 1);
            }
        }

        if (this.particles.length > 0) {
            requestAnimationFrame(() => this.animate());
        }
    }
}

window.Confetti = Confetti;
