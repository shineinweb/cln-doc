import { Injectable } from "@nestjs/common";
import { PLANS } from "@agency/billing";
import { APP_NAMES } from "@agency/shared";

@Injectable()
export class AppService {
  getInfo() {
    return {
      name: "Agency AI API",
      apps: APP_NAMES,
      plans: PLANS.map((plan) => plan.id),
    };
  }
}
