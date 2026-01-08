class Stars {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.stars = [];
        this.numStars = 150;
        this.realMouseX = 0;
        this.realMouseY = 0;

        this.init();
        this.animate();

        window.addEventListener('resize', () => this.resize());
        window.addEventListener('mousemove', (e) => {
            this.realMouseX = e.clientX;
            this.realMouseY = e.clientY;
        });
    }

    init() {
        this.resize();
        this.stars = [];
        for (let i = 0; i < this.numStars; i++) {
            this.stars.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                baseX: Math.random() * this.canvas.width,
                baseY: Math.random() * this.canvas.height,
                size: Math.random() * 1.8 + 0.5,
                opacity: Math.random() * 0.5 + 0.1,
                twinkleSpeed: Math.random() * 0.02 + 0.005,
                twinkleDir: 1,
                magneticFactor: Math.random() * 100 + 50 // How far they can be pulled
            });
        }
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    animate() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        this.stars.forEach(star => {
            // Update Twinkle
            star.opacity += star.twinkleSpeed * star.twinkleDir;
            if (star.opacity >= 0.8 || star.opacity <= 0.1) {
                star.twinkleDir *= -1;
            }

            // Calculate distance to mouse
            const dx = this.realMouseX - star.baseX;
            const dy = this.realMouseY - star.baseY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const maxDist = 400; // Radius of influence

            let displayX = star.baseX;
            let displayY = star.baseY;

            if (dist < maxDist) {
                // Pull factor: stronger pull when closer
                const pull = (1 - dist / maxDist) * star.magneticFactor;
                displayX += (dx / dist) * pull;
                displayY += (dy / dist) * pull;
            }

            // Draw Star
            this.ctx.beginPath();
            this.ctx.arc(displayX, displayY, star.size, 0, Math.PI * 2);
            this.ctx.fillStyle = `rgba(255, 255, 255, ${star.opacity})`;
            this.ctx.fill();
        });

        requestAnimationFrame(() => this.animate());
    }
}

// Initialize stars when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new Stars('stars-canvas');
});
