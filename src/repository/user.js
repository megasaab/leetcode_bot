const moment = require('moment');
const Database = require('../database');
const { getLeetcodeDataFromUsername } = require('../scraper');
const { log, delay } = require('../utils/helper');
const { DATE_FORMAT, DELAY_TIME_MS } = require('../utils/constants');
const DICT = require('../utils/dictionary');

class User {
  constructor() {
    this.objects = [];
  }

  // Return all users
  all() {
    return this.objects;
  }

  // Refresh Users map
  async refresh() {
    if (!Database.isRefreshing) {
      // Set database indicators
      Database.isRefreshing = true;
      Database.lastRefreshStartedAt = moment();

      // Log when refresh started
      log(DICT.DATABASE.STARTED_REFRESH, Database.lastRefreshStartedAt.format(DATE_FORMAT));

      // Get all users from database
      this.objects = await Database.findAllUsers();

      // Index of User, that is being currently updated
      let index = 0;

      // Modify users with data from LeetCode
      while (index < this.objects.length) {
        const user = this.objects[index];

        // eslint-disable-next-line no-await-in-loop
        const userData = await getLeetcodeDataFromUsername(user.username);

        if (userData) {
          this.objects[index] = userData;
          log(DICT.MESSAGE.USERNAME_WAS_REFRESHED(user.username));

          // If successfully loaded, go to next user
          index += 1;
        } else {
          log(DICT.MESSAGE.USERNAME_WAS_NOT_REFRESHED(user.username));
        }

        // Wait 4 seconds before loading next User, LeetCode only allows 15 requests per minute
        // eslint-disable-next-line no-await-in-loop
        await delay(DELAY_TIME_MS);
      }

      // Sort objects after refresh
      this.sort();

      // Set database indicators
      Database.isRefreshing = false;
      Database.lastRefreshFinishedAt = moment();

      // Log when refresh started
      log(DICT.DATABASE.IS_REFRESHED, Database.lastRefreshFinishedAt.format(DATE_FORMAT));
    } else {
      log(DICT.DATABASE.IS_ALREADY_REFRESHING);
    }
  }

  // Sort all Users by amount of solved questions on LeetCode
  async sort() {
    this.objects.sort(
      (user1, user2) => {
        const solved1 = user1.solved !== undefined
          ? parseInt(user1.solved, 10)
          : -Math.Infinity;
        const solved2 = user2.solved !== undefined
          ? parseInt(user2.solved, 10)
          : -Math.Infinity;
        return solved2 - solved1;
      },
    );
  }

  // Add User by Username
  async add(username) {
    const user = await Database.addUser(username);

    if (user) {
      // Load data from LeetCode by Username
      const userData = await getLeetcodeDataFromUsername(user.username);

      let status;

      if (userData) {
        this.objects.push(userData);

        // Sort objects after adding
        await this.sort();

        status = {
          status: DICT.STATUS.SUCCESS.DEFAULT,
          detail: DICT.STATUS.SUCCESS.ADDED_USER,
        };
      } else {
        // If user does not exist in LeetCode, remove User
        await Database.removeUser(username);

        status = {
          status: DICT.STATUS.ERROR.DEFAULT,
          detail: DICT.STATUS.ERROR.USERNAME_NOT_FOUND_ON_LEETCODE,
        };
      }

      return status;
    }

    return { status: DICT.STATUS.ERROR.DEFAULT, detail: DICT.STATUS.ERROR.USERNAME_ALREADY_EXISTS };
  }

  // Remove User by Username
  async remove(username) {
    const deleted = await Database.removeUser(username);

    if (deleted) {
      // Set objects array to tempObjects
      this.objects = this.objects.filter((user) => user.username !== username);

      // Sort objects after removing
      await this.sort();

      return { status: DICT.STATUS.SUCCESS.DEFAULT, detail: DICT.STATUS.SUCCESS.DELETED_USER };
    }

    return { status: DICT.STATUS.ERROR.DEFAULT, detail: DICT.STATUS.ERROR.USERNAME_NOT_FOUND };
  }

  // Load User by Username
  load(username) {
    return this.objects.find((user) => user.username.toLowerCase() === username);
  }
}

module.exports = new User();
