# syntax=docker/dockerfile:1
# The API image. Built the same way for local Compose, CI and the VM.
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
ENV DOTNET_CLI_TELEMETRY_OPTOUT=1 DOTNET_NOLOGO=1
WORKDIR /src

# Restore first, from project files only, so the layer is reused until a dependency changes.
COPY Directory.Build.props Directory.Packages.props .editorconfig ./
COPY src/FitIt.Api/FitIt.Api.csproj src/FitIt.Api/
COPY src/FitIt.Core/FitIt.Core.csproj src/FitIt.Core/
COPY src/FitIt.Infrastructure/FitIt.Infrastructure.csproj src/FitIt.Infrastructure/
RUN dotnet restore src/FitIt.Api/FitIt.Api.csproj

COPY src/ src/
RUN dotnet publish src/FitIt.Api/FitIt.Api.csproj --configuration Release --no-restore --output /app

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app
ENV ASPNETCORE_URLS=http://+:5080
EXPOSE 5080
COPY --from=build /app .
# The base image ships an unprivileged user; the API needs no write access to its own files.
USER $APP_UID
ENTRYPOINT ["dotnet", "FitIt.Api.dll"]
