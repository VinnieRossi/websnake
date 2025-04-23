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
    color: string = '#3498db' // Default to blue if no color provided
  ) {
    // Skip drawing if not visible (for invincibility blinking)
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