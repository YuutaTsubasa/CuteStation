import { type Rect, Physics } from "./Physics";
import { type Player } from "../entities/Player";
import { type Enemy } from "../entities/Enemy";

export type CombatHit = {
  enemy: Enemy;
  position: { x: number; y: number };
  attackType: "attack" | "homing";
};

type AttackProfile = {
  width: number;
  height: number;
  forwardOffset: number;
  verticalOffset: number;
  damage: number;
  knockback: { x: number; y: number };
};

export class Combat {
  private lastAttackId = -1;
  private readonly hitTargets = new Set<Enemy>();

  update(player: Player, enemies: Enemy[]): CombatHit[] {
    const hits: CombatHit[] = [];
    if (!player.isAttackActive()) {
      this.resetAttackState();
      return hits;
    }

    const attackId = player.getAttackSequence();
    if (attackId !== this.lastAttackId) {
      this.lastAttackId = attackId;
      this.hitTargets.clear();
    }

    const hitbox = this.getAttackHitbox(player);
    if (!hitbox) {
      return hits;
    }

    for (const enemy of enemies) {
      if (enemy.isDead()) {
        continue;
      }
      if (this.hitTargets.has(enemy)) {
        continue;
      }
      if (Physics.overlaps(hitbox, enemy.getRect())) {
        const profile = this.getAttackProfile(player, hitbox);
        const knockbackX = profile.knockback.x * player.getFacingDirection();
        const hit = enemy.applyHit(profile.damage, {
          x: knockbackX,
          y: profile.knockback.y,
        });
        if (hit) {
          this.hitTargets.add(enemy);
          hits.push({
            enemy,
            position: {
              x: hitbox.x + hitbox.width * 0.5,
              y: hitbox.y + hitbox.height * 0.5,
            },
            attackType: player.getAttackState(),
          });
        }
      }
    }

    return hits;
  }

  private resetAttackState() {
    this.lastAttackId = -1;
    this.hitTargets.clear();
  }

  private getAttackHitbox(player: Player): Rect | null {
    const state = player.getAttackState();
    if (state === "idle") {
      return null;
    }

    const rect = player.getRect();
    const profile = this.getAttackProfile(player);
    const centerX = rect.x + rect.width * 0.5;
    const centerY = rect.y + rect.height * 0.5 + profile.verticalOffset;
    const facing = player.getFacingDirection();

    const x = centerX + facing * profile.forwardOffset - profile.width * 0.5;
    const y = centerY - profile.height * 0.5;

    return {
      x,
      y,
      width: profile.width,
      height: profile.height,
    };
  }

  private getAttackProfile(player: Player, hitbox?: Rect): AttackProfile {
    const state = player.getAttackState();
    const baseWidth = player.width;
    const baseHeight = player.height;
    if (state === "homing") {
      return {
        width: baseWidth * 0.9,
        height: baseHeight * 0.7,
        forwardOffset: 0,
        verticalOffset: -baseHeight * 0.05,
        damage: 2,
        knockback: { x: baseWidth * 1.2, y: -baseHeight * 0.15 },
      };
    }

    const width = baseWidth * 1.1;
    return {
      width,
      height: baseHeight * 0.5,
      forwardOffset: baseWidth * 0.6 + width * 0.2,
      verticalOffset: -baseHeight * 0.1,
      damage: 1,
      knockback: {
        x: baseWidth * 1.4,
        y: hitbox ? -hitbox.height * 0.15 : -baseHeight * 0.15,
      },
    };
  }
}
