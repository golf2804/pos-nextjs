import { Controller, Get, Query } from "@nestjs/common";
import { SearchService } from "./search.service.js";

@Controller("search")
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  search(@Query("q") q = "") {
    return this.searchService.search(q);
  }
}
