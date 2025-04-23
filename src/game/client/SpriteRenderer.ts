export class SpriteRenderer {
  /**
   * Simple ball renderer for players
   * This replaces the sprite-based renderer completely, using colored circles instead
   */
  
  // Render a player as a colored circle
  drawPlayer(
    ctx: CanvasRenderingContext2D, 
    x: number, 
    y: number, 
    direction: 'up' | 'down' | 'left' | 'right',
    spriteRow: number,
    isMoving: boolean,
    isInvincible: boolean = false,
    isVisible: boolean = true,
    playerId: string = 'default',
    color: string = '#3498db', // Default to blue if no color provided
    trail: { x: number, y: number, timestamp: number }[] = [] // Trail segments
  ) {
    // First draw the light trail if it exists (always draw trails regardless of player visibility)
    if (trail && trail.length > 0) {
      this.drawTrail(ctx, trail, color);
    }
    
    // Skip drawing player if not visible (for invincibility blinking)
    if (!isVisible) {
      // Only draw a faint shadow when invisible
      this.drawShadow(ctx, x, y);
      return;
    }
    
    // Draw a shadow under the player
    this.drawShadow(ctx, x, y);
    
    // Draw the player as a colored circle
    ctx.beginPath();
    
    // Size of the player circle
    const radius = 18;
    
    // Save context for invincibility effects
    ctx.save();
    
    // Apply effects for invincible players
    if (isInvincible) {
      // Add a glowing effect
      ctx.shadowColor = 'rgba(0, 150, 255, 0.8)';
      ctx.shadowBlur = 15;
      ctx.globalAlpha = 0.9;
    }
    
    // Fill the main circle with player's color
    ctx.fillStyle = color;
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    
    // Draw a small direction indicator
    this.drawDirectionIndicator(ctx, x, y, direction, radius);
    
    // Restore context
    ctx.restore();
  }
  
  // Draw the light trail behind the player (Tron style)
  drawTrail(
    ctx: CanvasRenderingContext2D, 
    trail: { x: number, y: number, timestamp: number }[],
    color: string
  ) {
    // Need at least 2 points to draw a proper trail
    if (!trail || trail.length < 2) {
      return;
    }
    
    // Save context
    ctx.save();
    
    // Draw the light trail
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    // Add glow effect
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;
    
    // Start at the first point
    ctx.moveTo(trail[0].x, trail[0].y);
    
    // Connect all points
    for (let i = 1; i < trail.length; i++) {
      ctx.lineTo(trail[i].x, trail[i].y);
    }
    
    // Draw the trail
    ctx.stroke();
    
    // Restore context
    ctx.restore();
    
    // Add a brighter core to the trail
    ctx.save();
    ctx.beginPath();
    ctx.strokeStyle = '#ffffff'; // White core
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalAlpha = 0.7;
    
    // Start at the first point
    ctx.moveTo(trail[0].x, trail[0].y);
    
    // Connect all points
    for (let i = 1; i < trail.length; i++) {
      ctx.lineTo(trail[i].x, trail[i].y);
    }
    
    // Draw the core
    ctx.stroke();
    ctx.restore();
  }
  
  // Draw a shadow beneath the player
  private drawShadow(ctx: CanvasRenderingContext2D, x: number, y: number) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.ellipse(x, y + 10, 18, 8, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  
  // Draw a small indicator showing which direction the player is facing
  private drawDirectionIndicator(
    ctx: CanvasRenderingContext2D, 
    x: number, 
    y: number, 
    direction: 'up' | 'down' | 'left' | 'right',
    playerRadius: number
  ) {
    const indicatorOffset = playerRadius * 0.6; // Position the indicator near the edge
    
    // Set the indicator color
    ctx.fillStyle = 'white';
    
    // Position based on direction
    let indicatorX = x;
    let indicatorY = y;
    
    switch (direction) {
      case 'up':
        indicatorY = y - indicatorOffset;
        break;
      case 'down':
        indicatorY = y + indicatorOffset;
        break;
      case 'left':
        indicatorX = x - indicatorOffset;
        break;
      case 'right':
        indicatorX = x + indicatorOffset;
        break;
    }
    
    // Draw a small dot as the direction indicator
    ctx.beginPath();
    ctx.arc(indicatorX, indicatorY, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}