import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorators';
import { JwtAuthGuard } from '../auth/sync/jwt.auth.guard';
import { RolesGuard } from '../auth/sync/roles.guard';
import {
  ProfileVisibilityDto,
  UpdateProfileDto,
  UpdateSocialLinksDto,
} from './dto/profile.dto';
import { ProfileService } from './profile.service';

@ApiTags('profile')
@Controller({ version: '1', path: 'profile' })
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ARTIST)
  @ApiOperation({ summary: 'Get my artist profile with completeness' })
  async me(@CurrentUser() user: { sub: string }) {
    return this.profileService.getMyProfile(user.sub);
  }

  @Get('me/completeness')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ARTIST)
  @ApiOperation({ summary: 'Get my profile completeness score' })
  async completeness(@CurrentUser() user: { sub: string }) {
    return this.profileService.getCompleteness(user.sub);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ARTIST)
  @ApiOperation({ summary: 'Update bio, tagline, photos, and skills' })
  async update(
    @CurrentUser() user: { sub: string },
    @Body() dto: UpdateProfileDto,
  ) {
    return this.profileService.updateProfile(user.sub, dto);
  }

  @Patch('me/social-links')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ARTIST)
  @ApiOperation({ summary: 'Update social media links' })
  async socialLinks(
    @CurrentUser() user: { sub: string },
    @Body() dto: UpdateSocialLinksDto,
  ) {
    return this.profileService.updateSocialLinks(user.sub, dto);
  }

  @Patch('me/visibility')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ARTIST)
  @ApiOperation({ summary: 'Set profile public/hidden visibility' })
  async visibility(
    @CurrentUser() user: { sub: string },
    @Body() dto: ProfileVisibilityDto,
  ) {
    return this.profileService.setVisibility(user.sub, dto.isProfilePublic);
  }

  @Get(':artistId')
  @Public()
  @ApiOperation({ summary: 'Get a public artist profile' })
  async publicProfile(@Param('artistId') artistId: string) {
    return this.profileService.getPublicProfile(artistId);
  }
}
