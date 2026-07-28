import { BadRequestException, type ValidationError } from "@nestjs/common";

export type ApiValidationError = {
  field: string;
  messages: string[];
};

export function validationExceptionFactory(errors: ValidationError[]) {
  const validationErrors = flattenValidationErrors(errors);
  return new BadRequestException({
    statusCode: 400,
    error: "Validation failed",
    message: validationErrors.flatMap((item) => item.messages),
    validationErrors,
  });
}

function flattenValidationErrors(errors: ValidationError[], parent = ""): ApiValidationError[] {
  return errors.flatMap((error) => {
    const field = parent ? `${parent}.${error.property}` : error.property;
    const ownMessages = Object.values(error.constraints ?? {}).map((message) =>
      normalizeValidationMessage(field, message),
    );
    const children = flattenValidationErrors(error.children ?? [], field);
    return ownMessages.length
      ? [{ field, messages: ownMessages }, ...children]
      : children;
  });
}

function normalizeValidationMessage(field: string, message: string) {
  const label = humanize(field.split(".").at(-1) ?? field);
  const replacements: Array<[RegExp, string]> = [
    [/^.+ must be longer than or equal to (\d+) characters$/, `${label} must contain at least $1 characters.`],
    [/^.+ must be shorter than or equal to (\d+) characters$/, `${label} must not exceed $1 characters.`],
    [/^.+ must be an email$/, "Enter a valid email address."],
    [/^.+ must be a UUID$/, `Select a valid ${label.toLowerCase()}.`],
    [/^.+ must not be less than ([\d.]+)$/, `${label} must be at least $1.`],
    [/^.+ must be one of the following values: (.+)$/, `${label} must be one of: $1.`],
    [/^.+ must match .+ regular expression$/, `${label} has an invalid format.`],
    [/^.+ must be a string$/, `${label} must be text.`],
    [/^property .+ should not exist$/, `${label} is not an allowed field.`],
  ];
  for (const [pattern, replacement] of replacements) {
    if (pattern.test(message)) return message.replace(pattern, replacement);
  }
  return message.endsWith(".") ? message : `${message}.`;
}

function humanize(value: string) {
  const words = value.replace(/([a-z])([A-Z])/g, "$1 $2").replaceAll("_", " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}
