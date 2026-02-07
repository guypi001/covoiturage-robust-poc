import { Controller, Get } from '@nestjs/common';
import { PROFILE_QUESTIONS } from './profile-questions';

@Controller('profiles')
export class PublicProfileController {
  @Get('questions')
  async questions() {
    return { items: PROFILE_QUESTIONS };
  }
}
